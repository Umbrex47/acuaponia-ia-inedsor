import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import { ActuatorService } from '../actuators/actuator.service';
import { extractReadings } from '../alerts/thresholds';

/** Modo de operación del aireador. */
export type AeratorMode = 'auto' | 'on' | 'off';

export interface AeratorStatus {
  enabled: boolean;
  mode: AeratorMode;
  on: boolean;
  lastOxygen: number | null;
  lastPh: number | null;
  lastReason: string | null;
  lastChangeAt: string | null;
  oxygenOnBelow: number;
  oxygenOffAbove: number;
  phOnBelow: number;
}

/**
 * Motor de reglas para el aireador.
 *
 * Enciende el aireador automáticamente cuando:
 *  - El oxígeno disuelto cae por debajo de oxygenOnBelow.
 *  - El pH cae por debajo de phOnBelow (acidificación -> menos disponibilidad de O₂).
 *
 * Lo apaga cuando el oxígeno supera oxygenOffAbove y el pH está por encima
 * del umbral de emergencia.
 *
 * Salvaguardas: tiempo mínimo entre cambios (anti-ciclado) y override manual.
 */
@Injectable()
export class AeratorDecisionService implements OnModuleInit {
  private readonly logger = new Logger(AeratorDecisionService.name);
  private subscription: Subscription | null = null;

  private enabled = true;
  private mode: AeratorMode = 'auto';
  private on = false;
  private lastOxygen: number | null = null;
  private lastPh: number | null = null;
  private lastReason: string | null = null;
  private lastChangeAt = 0;

  private actuatorId = 'aireador';
  private oxygenOnBelow = 5;
  private oxygenOffAbove = 7;
  private phOnBelow = 6.5;
  private minStateMs = 60_000;

  constructor(
    private readonly mqtt: MqttService,
    private readonly actuatorService: ActuatorService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('decision.enabled', true);
    this.actuatorId = this.config.get<string>('decision.aerator.actuatorId', 'aireador');
    this.oxygenOnBelow = this.config.get<number>('decision.aerator.oxygenOnBelow', 5);
    this.oxygenOffAbove = this.config.get<number>('decision.aerator.oxygenOffAbove', 7);
    this.phOnBelow = this.config.get<number>('decision.aerator.phOnBelow', 6.5);
    this.minStateMs = this.config.get<number>('decision.aerator.minStateMs', 60_000);

    if (!this.enabled) {
      this.logger.warn('Motor de decisiones deshabilitado (DECISION_ENABLED=false)');
      return;
    }

    if (this.oxygenOnBelow >= this.oxygenOffAbove) {
      this.logger.warn(
        `AERATOR_OXYGEN_ON_BELOW (${this.oxygenOnBelow}) debería ser menor que AERATOR_OXYGEN_OFF_ABOVE (${this.oxygenOffAbove})`,
      );
    }

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.processPayload(payload);
    });

    this.logger.log(
      `Control de aireador activo → ${this.actuatorId} (ON si O2<${this.oxygenOnBelow} o pH<${this.phOnBelow}; OFF si O2>${this.oxygenOffAbove})`,
    );
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getStatus(): AeratorStatus {
    return {
      enabled: this.enabled,
      mode: this.mode,
      on: this.on,
      lastOxygen: this.lastOxygen,
      lastPh: this.lastPh,
      lastReason: this.lastReason,
      lastChangeAt: this.lastChangeAt ? new Date(this.lastChangeAt).toISOString() : null,
      oxygenOnBelow: this.oxygenOnBelow,
      oxygenOffAbove: this.oxygenOffAbove,
      phOnBelow: this.phOnBelow,
    };
  }

  /** Cambia el modo de operación. En `on`/`off` aplica el estado de inmediato. */
  setMode(mode: AeratorMode): AeratorStatus {
    this.mode = mode;
    this.logger.log(`Modo de aireador → ${mode}`);
    void this.applyDecision(`Modo manual: ${mode}`, true);
    return this.getStatus();
  }

  private processPayload(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const readings = extractReadings(data);
    let oxygenUpdated = false;
    let phUpdated = false;

    for (const { key, value } of readings) {
      if (key === 'oxigeno') {
        this.lastOxygen = value;
        oxygenUpdated = true;
      } else if (key === 'ph') {
        this.lastPh = value;
        phUpdated = true;
      }
    }

    if (!oxygenUpdated && !phUpdated) return;

    if (this.mode === 'auto') {
      void this.applyDecision('Regla automática por pH/Oxígeno', false);
    }
  }

  private async applyDecision(reason: string, force: boolean): Promise<void> {
    const desired = this.computeDesiredState();
    if (desired === null || desired === this.on) return;

    const now = Date.now();
    if (!force && now - this.lastChangeAt < this.minStateMs) {
      this.logger.debug(
        `Cambio de aireador omitido por anti-ciclado (faltan ${
          Math.round((this.minStateMs - (now - this.lastChangeAt)) / 1000)
        }s)`,
      );
      return;
    }

    await this.setAerator(desired, reason);
  }

  private computeDesiredState(): boolean | null {
    if (this.mode === 'on') return true;
    if (this.mode === 'off') return false;

    if (this.lastOxygen === null && this.lastPh === null) return null;

    const oxygenLow = this.lastOxygen !== null && this.lastOxygen <= this.oxygenOnBelow;
    const oxygenHigh = this.lastOxygen !== null && this.lastOxygen >= this.oxygenOffAbove;
    const phLow = this.lastPh !== null && this.lastPh <= this.phOnBelow;

    // Encender si alguna condición crítica se cumple.
    if (oxygenLow || phLow) return true;
    // Apagar solo si el oxígeno ya está alto Y el pH no está en emergencia.
    if (oxygenHigh && (this.lastPh === null || this.lastPh > this.phOnBelow + 0.3)) {
      return false;
    }
    // Zona muerta: mantener estado actual.
    return this.on;
  }

  private async setAerator(on: boolean, reason: string): Promise<void> {
    this.on = on;
    this.lastReason = reason;
    this.lastChangeAt = Date.now();

    const action = on ? 'on' : 'off';
    const result = await this.actuatorService.execute(this.actuatorId, action, {
      reason,
      actor: 'ia',
    });

    if (!result.ok) {
      this.logger.warn(`No se pudo cambiar aireador: ${result.reason}`);
      return;
    }

    this.logger.log(
      `Aireador ${on ? 'ENCENDIDO' : 'APAGADO'} — ${reason} (O2: ${this.lastOxygen ?? 'N/D'}, pH: ${this.lastPh ?? 'N/D'})`,
    );
  }
}
