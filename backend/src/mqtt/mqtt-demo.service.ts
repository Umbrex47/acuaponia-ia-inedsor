import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildPublishTopic, MQTT_TOPIC_SEGMENTS } from './topics.constants';
import { MqttService } from './mqtt.service';

/**
 * Publica telemetría de ejemplo cuando MQTT_DEMO_ENABLED=true.
 * Útil para probar el dashboard sin ESP32.
 */
@Injectable()
export class MqttDemoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttDemoService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled = this.config.get<boolean>('mqtt.demoEnabled', false);
    if (!enabled) return;

    const intervalMs = this.config.get<number>('mqtt.demoIntervalMs', 5000);
    const prefix = this.config.get<string>('mqtt.topicPrefix', 'aquaponic');

    this.logger.warn('Modo demo MQTT activo — publicando telemetría simulada');

    this.timer = setInterval(() => {
      const sensorsTopic = buildPublishTopic(
        prefix,
        MQTT_TOPIC_SEGMENTS.sensors,
        'telemetry',
      );

      this.mqtt.publish(sensorsTopic, {
        sensors: {
          ph: { value: 7.0 + Math.random() * 0.4, percent: 80, status: 'ok' },
          temperatura: {
            value: 28 + Math.random() * 3,
            percent: 55,
            status: 'ok',
          },
          oxigeno: { value: 8, percent: 72, status: 'ok' },
          nivelAgua: { value: 148, percent: 88, status: 'warn' },
          turbiedad: { value: 12 + Math.random() * 8, percent: 20, status: 'ok' },
        },
        system: { status: 'stable', statusLabel: 'Estable' },
      });
    }, intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
