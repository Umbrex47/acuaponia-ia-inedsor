import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import { extractReadings, SENSOR_THRESHOLDS } from '../alerts/thresholds';

export interface SensorLastSeen {
  /** Última lectura (valor numérico o NaN). */
  value: number | null;
  /** ISO timestamp del último mensaje MQTT que incluyó este sensor. */
  lastAt: string | null;
  /** Topic MQTT exacto del último mensaje. */
  lastTopic: string | null;
}

export interface MqttDebugSnapshot {
  /** Topic del último mensaje MQTT recibido por el backend. */
  lastTopic: string | null;
  /** Payload completo del último mensaje, como string. */
  lastRawPayload: string | null;
  /** ISO timestamp del último mensaje. */
  lastAt: string | null;
  /** Cantidad de mensajes recibidos desde el arranque. */
  messageCount: number;
  /** Última vez que vimos cada sensor conocido por nombre canónico. */
  bySensor: Record<string, SensorLastSeen>;
}

const MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Captura el último payload MQTT y la última vez que se vio cada sensor.
 * Sirve como herramienta de diagnóstico: si un sensor aparece `null` o
 * con `lastAt` muy viejo, indica que la ESP32 no lo está reportando.
 *
 * No persiste nada: el estado se reinicia con cada arranque del backend.
 */
@Injectable()
export class DebugService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DebugService.name);
  private subscription: Subscription | null = null;

  private lastTopic: string | null = null;
  private lastRawPayload: string | null = null;
  private lastAt: string | null = null;
  private messageCount = 0;

  private readonly bySensor = new Map<string, SensorLastSeen>();

  constructor(private readonly mqtt: MqttService) {
    for (const key of Object.keys(SENSOR_THRESHOLDS)) {
      this.bySensor.set(key, { value: null, lastAt: null, lastTopic: null });
    }
  }

  onModuleInit(): void {
    this.subscription = this.mqtt.messages$.subscribe(
      ({ topic, payload, receivedAt }) => {
        this.messageCount += 1;
        this.lastTopic = topic;
        this.lastRawPayload = payload;
        this.lastAt = receivedAt ?? new Date().toISOString();

        let data: unknown;
        try {
          data = JSON.parse(payload);
        } catch {
          return; // payload no JSON: lo ignoramos pero dejamos registrado
        }

        for (const { key, value } of extractReadings(data)) {
          const prev = this.bySensor.get(key);
          // lastTopic del sensor: el del mensaje que lo trae.
          this.bySensor.set(key, {
            value,
            lastAt: this.lastAt,
            lastTopic: topic,
          });
          // Si el sensor ya tenía valor, prev != null es esperable.
          if (!prev) this.logger.debug(`Sensor nuevo visto: ${key}`);
        }
      },
    );

    this.logger.log('Debug MQTT activo — GET /api/debug/last-mqtt');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Snapshot del estado MQTT observado. */
  getSnapshot(): MqttDebugSnapshot {
    const bySensor: Record<string, SensorLastSeen> = {};
    const now = Date.now();

    for (const [key, entry] of this.bySensor) {
      let ageMs: number | null = null;
      if (entry.lastAt) {
        ageMs = now - new Date(entry.lastAt).getTime();
        // Si el último avistamiento es muy viejo, lo marcamos como "no visto".
        if (ageMs > MAX_AGE_MS) {
          bySensor[key] = { value: null, lastAt: entry.lastAt, lastTopic: entry.lastTopic };
          continue;
        }
      }
      bySensor[key] = entry;
    }

    return {
      lastTopic: this.lastTopic,
      lastRawPayload: this.lastRawPayload,
      lastAt: this.lastAt,
      messageCount: this.messageCount,
      bySensor,
    };
  }
}