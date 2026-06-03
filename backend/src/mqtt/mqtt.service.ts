import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import mqtt, { MqttClient } from 'mqtt';
import { Subject } from 'rxjs';
import { buildSubscribeTopics } from './topics.constants';
import type { MqttConnectionStatus, MqttInboundMessage } from './mqtt.types';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: MqttClient | null = null;
  private status: MqttConnectionStatus = { connected: false, error: null };

  readonly messages$ = new Subject<MqttInboundMessage>();
  readonly status$ = new Subject<MqttConnectionStatus>();

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.connect();
  }

  onModuleDestroy(): void {
    this.disconnect();
    this.messages$.complete();
    this.status$.complete();
  }

  getConnectionStatus(): MqttConnectionStatus {
    return { ...this.status };
  }

  publish(topic: string, payload: unknown, retain = false): boolean {
    if (!this.client?.connected) {
      this.logger.warn(`MQTT no conectado; no se publicó en ${topic}`);
      return false;
    }

    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload);

    this.client.publish(topic, body, { qos: 0, retain }, (err) => {
      if (err) {
        this.logger.error(`Error al publicar en ${topic}: ${err.message}`);
      }
    });

    return true;
  }

  private connect(): void {
    const url = this.config.get<string>('mqtt.url', 'mqtt://localhost:1883');
    const clientId = this.config.get<string>('mqtt.clientId', 'aquaponic-backend');
    const username = this.config.get<string | undefined>('mqtt.username');
    const password = this.config.get<string | undefined>('mqtt.password');
    const reconnectMs = this.config.get<number>('mqtt.reconnectMs', 3000);
    const topicPrefix = this.config.get<string>('mqtt.topicPrefix', 'aquaponic');
    const topics = buildSubscribeTopics(topicPrefix);

    const options: mqtt.IClientOptions = {
      clientId,
      clean: true,
      reconnectPeriod: reconnectMs,
      connectTimeout: 10_000,
    };

    if (username) options.username = username;
    if (password) options.password = password;

    this.logger.log(`Conectando a MQTT: ${url}`);
    this.client = mqtt.connect(url, options);

    this.client.on('connect', () => {
      this.setStatus({ connected: true, error: null });
      this.logger.log('MQTT conectado');

      topics.forEach((topic) => {
        this.client?.subscribe(topic, (err) => {
          if (err) {
            this.logger.warn(`No se pudo suscribir a ${topic}: ${err.message}`);
          } else {
            this.logger.log(`Suscrito: ${topic}`);
          }
        });
      });
    });

    this.client.on('message', (topic, buffer) => {
      const message: MqttInboundMessage = {
        topic,
        payload: buffer.toString(),
        receivedAt: new Date().toISOString(),
      };
      this.messages$.next(message);
    });

    this.client.on('error', (err) => {
      this.setStatus({ connected: false, error: err.message });
      this.logger.error(`MQTT error: ${err.message}`);
    });

    this.client.on('offline', () => {
      this.setStatus({ connected: false, error: 'Broker offline' });
    });

    this.client.on('reconnect', () => {
      this.setStatus({ connected: false, error: 'Reconectando…' });
    });
  }

  private disconnect(): void {
    if (!this.client) return;
    this.client.end(true);
    this.client = null;
    this.setStatus({ connected: false, error: null });
  }

  private setStatus(next: MqttConnectionStatus): void {
    this.status = next;
    this.status$.next(next);
  }
}
