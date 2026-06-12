import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildPublishTopic, MQTT_TOPIC_SEGMENTS } from './topics.constants';
import { MqttService } from './mqtt.service';

interface DemoSensor {
  min: number;
  max: number;
  optimal: [number, number];
  step: number;
  decimals: number;
}

// Escalas reales de cada sensor (coinciden con SENSOR_META del frontend y con
// thresholds.ts). Permiten generar valores coherentes con su rango.
const DEMO_SENSORS: Record<string, DemoSensor> = {
  temperatura: { min: 15, max: 35, optimal: [20, 28], step: 0.15, decimals: 1 },
  ph: { min: 0, max: 14, optimal: [6.5, 8], step: 0.04, decimals: 2 },
  oxigeno: { min: 0, max: 15, optimal: [5, 12], step: 0.12, decimals: 1 },
  nivelAgua: { min: 0, max: 32, optimal: [24, 32], step: 0.3, decimals: 1 },
  nitratos: { min: 0, max: 50, optimal: [5, 40], step: 0.4, decimals: 0 },
  co2: { min: 0, max: 1000, optimal: [50, 600], step: 6, decimals: 0 },
  electroconductividad: { min: 0, max: 3, optimal: [0.8, 2], step: 0.02, decimals: 2 },
  turbiedad: { min: 0, max: 100, optimal: [0, 25], step: 0.8, decimals: 1 },
  temperaturaAmbiente: { min: 5, max: 45, optimal: [18, 32], step: 0.2, decimals: 1 },
  humedad: { min: 0, max: 100, optimal: [40, 75], step: 0.6, decimals: 0 },
  presion: { min: 900, max: 1100, optimal: [950, 1050], step: 0.5, decimals: 0 },
};

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

const round = (v: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/**
 * Publica telemetría de ejemplo cuando MQTT_DEMO_ENABLED=true.
 *
 * Usa un random walk con reversión a la media: cada tick mueve los valores un
 * paso pequeño y los empuja suavemente hacia el centro del rango óptimo, de
 * modo que las curvas se ven realistas y estables (en lugar de saltos
 * aleatorios). Útil para una demo pública sin ESP32.
 */
@Injectable()
export class MqttDemoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttDemoService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly state = new Map<string, number>();

  constructor(
    private readonly mqtt: MqttService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<boolean>('mqtt.demoEnabled', false);
    if (!enabled) return;

    const intervalMs = this.config.get<number>('mqtt.demoIntervalMs', 5000);
    const prefix = this.config.get<string>('mqtt.topicPrefix', 'aquaponic');

    // Estado inicial: centro del rango óptimo de cada sensor.
    for (const [key, def] of Object.entries(DEMO_SENSORS)) {
      this.state.set(key, (def.optimal[0] + def.optimal[1]) / 2);
    }

    this.logger.warn('Modo demo MQTT activo — publicando telemetría simulada');

    const sensorsTopic = buildPublishTopic(
      prefix,
      MQTT_TOPIC_SEGMENTS.sensors,
      'telemetry',
    );

    this.timer = setInterval(() => {
      this.mqtt.publish(sensorsTopic, this.buildPayload());
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private nextValue(key: string, def: DemoSensor): number {
    const [lo, hi] = def.optimal;
    const center = (lo + hi) / 2;
    const halfRange = (hi - lo) / 2 || 1;
    const current = this.state.get(key) ?? center;

    const wander = (Math.random() * 2 - 1) * def.step;
    const pull = ((center - current) / halfRange) * def.step * 0.5;

    // Mantiene los valores dentro del óptimo (con un pequeño margen) para que
    // la demo se vea saludable y estable.
    const margin = halfRange * 0.15;
    let value = current + wander + pull;
    value = clamp(value, lo - margin, hi + margin);
    value = clamp(value, def.min, def.max);

    this.state.set(key, value);
    return round(value, def.decimals);
  }

  private buildPayload() {
    const sensors: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(DEMO_SENSORS)) {
      const value = this.nextValue(key, def);
      const percent = clamp(
        Math.round(((value - def.min) / (def.max - def.min)) * 100),
        0,
        100,
      );
      sensors[key] = { value, percent, status: 'ok' };
    }

    return {
      sensors,
      source: 'demo',
      system: { status: 'stable', statusLabel: 'Estable' },
      timestamp: new Date().toISOString(),
    };
  }
}
