import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { extractReadings } from '../alerts/thresholds';
import { MqttService } from '../mqtt/mqtt.service';
import { ActuatorService } from '../actuators/actuator.service';

interface Rule {
  id: string;
  /** Sensor evaluado. */
  sensor: string;
  comparator: 'lt' | 'gt';
  threshold: number;
  /** Actuador a operar. */
  actuatorId: string;
  action: 'on' | 'off';
  /** Solo si el actuador está en este modo (o vacío = sin importar). */
  requireMode?: 'auto' | 'ia' | 'manual';
  /** Descripción legible. */
  description: string;
}

const RULES: Rule[] = [
  {
    id: 'o2_critical',
    sensor: 'oxigeno',
    comparator: 'lt',
    threshold: 3,
    actuatorId: 'aireador',
    action: 'on',
    description: 'Oxígeno crítico (<3 mg/L) → encender aireador',
  },
  {
    id: 'o2_extreme',
    sensor: 'oxigeno',
    comparator: 'lt',
    threshold: 2,
    actuatorId: 'bomba_agua',
    action: 'on',
    requireMode: 'ia',
    description: 'Oxígeno extremo (<2 mg/L) → activar bomba para recirculación',
  },
  {
    id: 'nivel_dry',
    sensor: 'nivelAgua',
    comparator: 'lt',
    threshold: 10,
    actuatorId: 'bomba_agua',
    action: 'off',
    description: 'Nivel crítico (<10 cm) → apagar bomba (anti-marcha en seco)',
  },
  {
    id: 'temperatura_alta',
    sensor: 'temperatura',
    comparator: 'gt',
    threshold: 32,
    actuatorId: 'aireador',
    action: 'on',
    description: 'Temperatura alta (>32 °C) → aireador encendido',
  },
];

@Injectable()
export class EmergencyPolicyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmergencyPolicyService.name);
  private subscription: Subscription | null = null;
  private enabled = true;
  private cooldownMs = 60_000;
  private lastFired = new Map<string, number>();

  constructor(
    private readonly mqtt: MqttService,
    private readonly actuators: ActuatorService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('emergency.enabled', true);
    this.cooldownMs = this.config.get<number>('emergency.cooldownMs', 60_000);

    if (!this.enabled) {
      this.logger.warn('Política de emergencias deshabilitada');
      return;
    }

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.processPayload(payload);
    });

    this.logger.log(`EmergencyPolicy activo (${RULES.length} reglas, cooldown ${this.cooldownMs}ms)`);
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Lista de reglas para inspección / pruebas. */
  listRules(): Rule[] {
    return RULES.map((r) => ({ ...r }));
  }

  private processPayload(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const readings = extractReadings(data);
    if (readings.length === 0) return;

    for (const rule of RULES) {
      const reading = readings.find((r) => r.key === rule.sensor);
      if (!reading) continue;

      const tripped =
        rule.comparator === 'lt' ? reading.value < rule.threshold : reading.value > rule.threshold;
      if (!tripped) continue;

      const last = this.lastFired.get(rule.id) ?? 0;
      if (Date.now() - last < this.cooldownMs) continue;
      this.lastFired.set(rule.id, Date.now());

      this.logger.warn(
        `⚠️  Regla ${rule.id}: ${reading.key}=${reading.value} → ${rule.actuatorId} ${rule.action}`,
      );

      void this.actuators.execute(rule.actuatorId, rule.action, {
        reason: `${rule.description} (${reading.key}=${reading.value})`,
        actor: 'emergency',
        bypassMode: true,
      });
    }
  }
}
