import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { buildPublishTopic } from '../mqtt/topics.constants';
import { extractReadings } from '../alerts/thresholds';

/** Modo de operación de la bomba. */
export type PumpMode = 'auto' | 'on' | 'off';

export interface PumpStatus {
  enabled: boolean;
  mode: PumpMode;
  pumpOn: boolean;
  lastLevel: number | null;
  lastReason: string | null;
  lastChangeAt: string | null;
  onLevel: number;
  offLevel: number;
}

/**
 * Motor de reglas para la bomba de agua.
 *
 * Lógica (modo automático) con histéresis sobre el nivel de agua:
 *  - nivel <= offLevel → apaga la bomba (protección anti-marcha en seco).
 *  - nivel >= onLevel  → enciende la bomba (recirculación).
 *  - entre ambos       → mantiene el estado actual (evita rebote).
 *
 * Salvaguardas: tiempo mínimo en cada estado (anti-ciclado) y override manual
 * (`on`/`off`) que ignora las reglas. Cada cambio publica un comando MQTT en
 * `<prefix>/commands/<actuatorId>` y notifica por correo + Telegram.
 *
 * NOTA (fase 2): este servicio es el punto donde se conectará la predicción
 * (p. ej. "el nivel va a caer en 1 h → adelantar acción").
 */
@Injectable()
export class PumpDecisionService implements OnModuleInit {
  private readonly logger = new Logger(PumpDecisionService.name);
  private subscription: Subscription | null = null;

  private enabled = true;
  private mode: PumpMode = 'auto';
  private pumpOn = false;
  private lastLevel: number | null = null;
  private lastReason: string | null = null;
  private lastChangeAt = 0;

  private actuatorId = 'bomba_agua';
  private commandTopic = '';
  private onLevel = 24;
  private offLevel = 20;
  private minStateMs = 60_000;

  constructor(
    private readonly mqtt: MqttService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('decision.enabled', true);
    this.actuatorId = this.config.get<string>('decision.pump.actuatorId', 'bomba_agua');
    this.onLevel = this.config.get<number>('decision.pump.onLevel', 24);
    this.offLevel = this.config.get<number>('decision.pump.offLevel', 20);
    this.minStateMs = this.config.get<number>('decision.pump.minStateMs', 60_000);

    const prefix = this.config.get<string>('mqtt.topicPrefix', 'aquaponic');
    this.commandTopic = buildPublishTopic(prefix, 'commands', this.actuatorId);

    if (!this.enabled) {
      this.logger.warn('Motor de decisiones deshabilitado (DECISION_ENABLED=false)');
      return;
    }

    if (this.offLevel >= this.onLevel) {
      this.logger.warn(
        `PUMP_OFF_LEVEL (${this.offLevel}) debería ser menor que PUMP_ON_LEVEL (${this.onLevel})`,
      );
    }

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.processPayload(payload);
    });

    this.logger.log(
      `Control de bomba activo → ${this.commandTopic} (on≥${this.onLevel} / off≤${this.offLevel})`,
    );
  }

  getStatus(): PumpStatus {
    return {
      enabled: this.enabled,
      mode: this.mode,
      pumpOn: this.pumpOn,
      lastLevel: this.lastLevel,
      lastReason: this.lastReason,
      lastChangeAt: this.lastChangeAt ? new Date(this.lastChangeAt).toISOString() : null,
      onLevel: this.onLevel,
      offLevel: this.offLevel,
    };
  }

  /** Cambia el modo de operación. En `on`/`off` aplica el estado de inmediato. */
  setMode(mode: PumpMode): PumpStatus {
    this.mode = mode;
    this.logger.log(`Modo de bomba → ${mode}`);
    this.applyDecision(`Modo manual: ${mode}`, true);
    return this.getStatus();
  }

  private processPayload(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const reading = extractReadings(data).find((r) => r.key === 'nivelAgua');
    if (!reading) return;

    this.lastLevel = reading.value;
    if (this.mode === 'auto') {
      this.applyDecision('Regla automática por nivel de agua', false);
    }
  }

  /** Calcula el estado deseado y, si procede, lo aplica respetando las salvaguardas. */
  private applyDecision(reason: string, force: boolean): void {
    const desired = this.computeDesiredState();
    if (desired === null || desired === this.pumpOn) return;

    const now = Date.now();
    if (!force && now - this.lastChangeAt < this.minStateMs) {
      this.logger.debug(
        `Cambio de bomba omitido por anti-ciclado (faltan ${
          Math.round((this.minStateMs - (now - this.lastChangeAt)) / 1000)
        }s)`,
      );
      return;
    }

    this.setPump(desired, reason);
  }

  private computeDesiredState(): boolean | null {
    if (this.mode === 'on') return true;
    if (this.mode === 'off') return false;

    // modo auto: histéresis por nivel
    if (this.lastLevel === null) return null;
    if (this.lastLevel <= this.offLevel) return false;
    if (this.lastLevel >= this.onLevel) return true;
    return this.pumpOn; // zona muerta: sin cambio
  }

  private setPump(on: boolean, reason: string): void {
    this.pumpOn = on;
    this.lastReason = reason;
    this.lastChangeAt = Date.now();

    const command = {
      actuator: this.actuatorId,
      action: on ? 'on' : 'off',
      reason,
      mode: this.mode,
      level: this.lastLevel,
      timestamp: new Date().toISOString(),
    };
    // Evento puntual: no se retiene para evitar que la ESP32 repita el
    // comando cada vez que se reconecta al broker.
    this.mqtt.publish(this.commandTopic, command, false);

    this.logger.log(
      `Bomba ${on ? 'ENCENDIDA' : 'APAGADA'} — ${reason} (nivel: ${this.lastLevel ?? 'N/D'} cm)`,
    );

    void this.notify(on, reason);
  }

  private async notify(on: boolean, reason: string): Promise<void> {
    const action = on ? 'ENCENDIDA' : 'APAGADA';
    const emoji = on ? '🟢' : '🔴';
    const levelText = this.lastLevel != null ? `${this.lastLevel} cm` : 'N/D';
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });

    const subject = `[Aquaponía] Bomba de agua ${action}`;
    const text = [
      `La bomba de agua fue ${action} automáticamente.`,
      ``,
      `Motivo: ${reason}`,
      `Nivel de agua: ${levelText}`,
      `Modo: ${this.mode}`,
      `Fecha: ${timestamp}`,
    ].join('\n');

    const accent = on ? '#16A34A' : '#DC2626';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:${accent};color:#fff;padding:18px 24px">
          <h1 style="margin:0;font-size:18px">Bomba de agua ${action}</h1>
        </div>
        <div style="padding:24px;color:#0a0a0a;font-size:14px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666">Motivo</td><td style="padding:6px 0;text-align:right;font-weight:bold">${reason}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Nivel de agua</td><td style="padding:6px 0;text-align:right">${levelText}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Modo</td><td style="padding:6px 0;text-align:right">${this.mode}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Fecha</td><td style="padding:6px 0;text-align:right">${timestamp}</td></tr>
          </table>
        </div>
      </div>
    `;

    const telegramText = [
      `${emoji} <b>Bomba de agua ${action}</b>`,
      ``,
      `<b>Motivo:</b> ${reason}`,
      `<b>Nivel de agua:</b> ${levelText}`,
      `<b>Modo:</b> ${this.mode}`,
      `<b>Fecha:</b> ${timestamp}`,
    ].join('\n');

    await Promise.all([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);
  }
}
