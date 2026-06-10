import {
  Injectable,
  Logger,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import {
  evaluateRisk,
  extractReadings,
  SENSOR_THRESHOLDS,
} from '../alerts/thresholds';
import {
  SensorReading,
  SensorReadingDocument,
} from './schemas/sensor-reading.schema';

/** Estadísticas agregadas de un sensor en una ventana de tiempo. */
export interface SensorStat {
  sensorKey: string;
  label: string;
  unit: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  /** Lecturas por debajo del rango óptimo. */
  low: number;
  /** Lecturas por encima del rango óptimo. */
  high: number;
  lastValue: number;
  lastAt: Date;
}

@Injectable()
export class ReadingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadingsService.name);
  private subscription: Subscription | null = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly config: ConfigService,
    // El modelo solo existe si MONGODB_URI está configurado; de lo contrario
    // queda undefined y la persistencia se desactiva sin romper la app.
    @Optional()
    @InjectModel(SensorReading.name)
    private readonly model?: Model<SensorReadingDocument>,
  ) {}

  onModuleInit(): void {
    if (!this.model) {
      this.logger.warn(
        'Registro en MongoDB desactivado — configura MONGODB_URI para habilitarlo',
      );
      return;
    }

    if (!this.config.get<boolean>('readings.persistEnabled', true)) {
      this.logger.warn('Persistencia desactivada (READINGS_PERSIST_ENABLED=false)');
      return;
    }

    this.subscription = this.mqtt.messages$.subscribe(({ payload, receivedAt }) => {
      void this.persist(payload, receivedAt);
    });

    this.logger.log('Registro de parámetros en MongoDB activo');
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  get isEnabled(): boolean {
    return this.model != null;
  }

  private async persist(raw: string, receivedAt?: string): Promise<void> {
    if (!this.model) return;

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return; // payload no JSON
    }

    const readings = extractReadings(data);
    if (readings.length === 0) return;

    const recordedAt = receivedAt ? new Date(receivedAt) : new Date();

    const docs = readings.map(({ key, value }) => {
      const meta = SENSOR_THRESHOLDS[key];
      return {
        sensorKey: key,
        label: meta.label,
        value,
        unit: meta.unit,
        riskLevel: evaluateRisk(key, value) ?? 'stable',
        source: 'mqtt',
        recordedAt,
      };
    });

    try {
      await this.model.insertMany(docs, { ordered: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`No se pudieron guardar las lecturas: ${msg}`);
    }
  }

  /** Guarda una lectura individual (p. ej. desde la entrada manual). */
  async record(
    sensorKey: string,
    value: number,
    source = 'manual',
  ): Promise<SensorReadingDocument | null> {
    if (!this.model) return null;
    const meta = SENSOR_THRESHOLDS[sensorKey];
    if (!meta) return null;

    return this.model.create({
      sensorKey,
      label: meta.label,
      value,
      unit: meta.unit,
      riskLevel: evaluateRisk(sensorKey, value) ?? 'stable',
      source,
      recordedAt: new Date(),
    });
  }

  /** Historial más reciente, opcionalmente filtrado por sensor. */
  async findRecent(sensorKey?: string, limit = 100): Promise<SensorReading[]> {
    if (!this.model) return [];
    const filter = sensorKey ? { sensorKey } : {};
    return this.model
      .find(filter)
      .sort({ recordedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 1000))
      .lean<SensorReading[]>()
      .exec();
  }

  /**
   * Estadísticas agregadas por sensor desde una fecha dada.
   * Base para el reporte de progreso y para futuros análisis/predicción.
   */
  async statsSince(since: Date): Promise<SensorStat[]> {
    if (!this.model) return [];
    return this.model
      .aggregate<SensorStat>([
        { $match: { recordedAt: { $gte: since } } },
        { $sort: { recordedAt: 1 } },
        {
          $group: {
            _id: '$sensorKey',
            label: { $first: '$label' },
            unit: { $first: '$unit' },
            count: { $sum: 1 },
            min: { $min: '$value' },
            max: { $max: '$value' },
            avg: { $avg: '$value' },
            low: { $sum: { $cond: [{ $eq: ['$riskLevel', 'low'] }, 1, 0] } },
            high: { $sum: { $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0] } },
            lastValue: { $last: '$value' },
            lastAt: { $last: '$recordedAt' },
          },
        },
        { $project: { _id: 0, sensorKey: '$_id', label: 1, unit: 1, count: 1, min: 1, max: 1, avg: 1, low: 1, high: 1, lastValue: 1, lastAt: 1 } },
        { $sort: { sensorKey: 1 } },
      ])
      .exec();
  }

  /** Última lectura conocida por cada sensor. */
  async findLatestBySensor(): Promise<SensorReading[]> {
    if (!this.model) return [];
    return this.model
      .aggregate<SensorReading>([
        { $sort: { recordedAt: -1 } },
        { $group: { _id: '$sensorKey', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } },
        { $sort: { sensorKey: 1 } },
      ])
      .exec();
  }
}
