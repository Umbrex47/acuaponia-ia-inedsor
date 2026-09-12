import {
  Inject,
  Injectable,
  Logger,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
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
import {
  ManualReading,
  ManualReadingDocument,
  ParameterEvaluation,
} from './schemas/manual-reading.schema';
import {
  CreateManualReadingDto,
  ManualHistoryQueryDto,
} from './dto/create-manual-reading.dto';
import { NotificationService } from '../notifications/notification.service';

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
  private readonly memoryManualRecords: any[] = [];
  private latestManualRecord: any = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly config: ConfigService,
    // El modelo solo existe si MONGODB_URI está configurado; de lo contrario
    // queda undefined y la persistencia se desactiva sin romper la app.
    @Optional()
    @InjectModel(SensorReading.name)
    private readonly model?: Model<SensorReadingDocument>,

    @Optional()
    @InjectModel(ManualReading.name)
    private readonly manualModel?: Model<ManualReadingDocument>,

    @Optional()
    @Inject(forwardRef(() => NotificationService))
    private readonly notifications?: NotificationService,
  ) {}

  onModuleInit(): void {
    if (!this.model) {
      this.logger.warn(
        'Registro en MongoDB desactivado — configura MONGODB_URI para persistencia permanente',
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
    return this.model != null || this.manualModel != null;
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
        label: meta?.label || key,
        value,
        unit: meta?.unit || '',
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

  /**
   * Registra un muestreo manual completo con trazabilidad de operador, fecha/hora,
   * evaluación de rangos de calidad de agua y observaciones de peces.
   */
  async recordManualSample(dto: CreateManualReadingDto) {
    const operator = dto.operator?.trim() || 'Operador Anónimo';
    const operatorRole = dto.operatorRole?.trim() || 'Técnico';
    const sampleDate = dto.timestamp ? new Date(dto.timestamp) : new Date();
    const source = dto.source || 'mobile-app';

    // 1. Evaluar cada variable ingresada contra los umbrales seguros
    const evaluations: Record<string, ParameterEvaluation> = {};
    const riskyAlerts: Array<{ key: string; label: string; value: number; unit: string; level: 'low' | 'high' }> = [];

    for (const [rawKey, rawVal] of Object.entries(dto.values || {})) {
      const val = Number(rawVal);
      if (!Number.isFinite(val)) continue;

      const meta = SENSOR_THRESHOLDS[rawKey];
      const label = meta?.label || rawKey;
      const unit = meta?.unit || '';
      const riskLevel = evaluateRisk(rawKey, val) ?? 'stable';

      evaluations[rawKey] = {
        value: val,
        label,
        unit,
        riskLevel,
      };

      if (riskLevel === 'high' || riskLevel === 'low') {
        riskyAlerts.push({ key: rawKey, label, value: val, unit, level: riskLevel });
      }
    }

    const recordPayload = {
      operator,
      operatorRole,
      timestamp: sampleDate,
      recordedAt: new Date(),
      values: dto.values || {},
      evaluations,
      notes: dto.notes || '',
      fishObservation: dto.fishObservation || { mortalityCount: 0, behaviorNotes: '' },
      source,
    };

    // 2. Persistir en la colección de manual_readings
    let savedRecord: any = null;
    if (this.manualModel) {
      try {
        savedRecord = await this.manualModel.create(recordPayload);
      } catch (err) {
        this.logger.error(`Error al persistir registro manual: ${(err as Error).message}`);
      }
    }

    if (!savedRecord) {
      // Almacenar en memoria en caso de no contar con MongoDB conectado
      savedRecord = {
        _id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...recordPayload,
      };
      this.memoryManualRecords.unshift(savedRecord);
      if (this.memoryManualRecords.length > 200) {
        this.memoryManualRecords.pop();
      }
    }

    this.latestManualRecord = savedRecord;

    // 3. Insertar cada variable en sensor_readings para unificar gráficos e historial
    if (this.model && Object.keys(dto.values || {}).length > 0) {
      const sensorDocs = Object.entries(dto.values).map(([key, val]) => {
        const numVal = Number(val);
        const meta = SENSOR_THRESHOLDS[key];
        return {
          sensorKey: key,
          label: meta?.label || key,
          value: numVal,
          unit: meta?.unit || '',
          riskLevel: evaluateRisk(key, numVal) ?? 'stable',
          source,
          recordedBy: operator,
          notes: dto.notes,
          recordedAt: sampleDate,
        };
      });

      try {
        await this.model.insertMany(sensorDocs, { ordered: false });
      } catch (err) {
        this.logger.warn(`No se insertaron todas las lecturas de sensores: ${(err as Error).message}`);
      }
    }

    // 4. Publicar actualización a MQTT para sincronización en tiempo real
    this.mqtt.publish(
      'aquaponic/sensors/manual',
      JSON.stringify({
        operator,
        timestamp: sampleDate.toISOString(),
        sensors: dto.values,
        notes: dto.notes,
        fishObservation: dto.fishObservation,
      }),
      true,
    );

    // 5. Emitir notificaciones en base a los hallazgos del muestreo
    if (this.notifications) {
      const timeString = sampleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Si hay parámetros en nivel de riesgo (especialmente nitritos, amonio, pH o bajo oxígeno)
      for (const alert of riskyAlerts) {
        const isCriticalParam = ['nitritos', 'amonio', 'oxigeno', 'ph'].includes(alert.key);
        const severity = isCriticalParam || alert.level === 'high' ? 'critical' : 'warn';
        const conditionText = alert.level === 'high' ? 'por encima del límite seguro' : 'por debajo del rango óptimo';

        await this.notifications.emit({
          category: 'sensor-alert',
          severity,
          title: `Alerta: ${alert.label} ${conditionText} (${alert.value} ${alert.unit})`,
          message: `En el muestreo manual de las ${timeString}, ${operator} reportó ${alert.label} en ${alert.value} ${alert.unit}. Nivel ${alert.level.toUpperCase()}.`,
          source: 'manual',
          meta: {
            sensorKey: alert.key,
            value: alert.value,
            riskLevel: alert.level,
            operator,
            timestamp: sampleDate,
          },
        });
      }

      // Si se reportó mortalidad en peces
      const mortality = Number(dto.fishObservation?.mortalityCount || 0);
      if (mortality > 0) {
        await this.notifications.emit({
          category: 'early-warning',
          severity: mortality >= 3 ? 'critical' : 'warn',
          title: `Alerta peces: ${mortality} pez/peces de baja observados`,
          message: `${operator} reportó mortalidad de ${mortality} peces a las ${timeString}. Observación: ${dto.fishObservation?.behaviorNotes || 'Sin notas adicionales'}.`,
          source: 'manual',
          meta: {
            mortalityCount: mortality,
            operator,
            timestamp: sampleDate,
            behavior: dto.fishObservation?.behaviorNotes,
          },
        });
      }

      // Notificación general informativa de confirmación de registro
      const varCount = Object.keys(dto.values || {}).length;
      await this.notifications.emit({
        category: 'system',
        severity: riskyAlerts.length > 0 ? 'warn' : 'success',
        title: `Muestreo manual registrado por ${operator}`,
        message: `Se actualizaron ${varCount} variables a las ${timeString}. ${riskyAlerts.length > 0 ? `Se detectaron ${riskyAlerts.length} parámetros fuera de rango.` : 'Todos los valores en rango estable.'}`,
        source: 'manual',
        meta: {
          operator,
          timestamp: sampleDate,
          variablesCount: varCount,
          riskyCount: riskyAlerts.length,
        },
      });
    }

    return savedRecord;
  }

  /** Historial de muestreos manuales con paginación y filtros. */
  async findManualHistory(query: ManualHistoryQueryDto = {}) {
    const limit = Math.min(Math.max(query.limit ? Number(query.limit) : 50, 1), 200);
    const skip = Math.max(query.skip ? Number(query.skip) : 0, 0);

    if (this.manualModel) {
      const filter: Record<string, unknown> = {};
      if (query.operator) {
        filter.operator = { $regex: query.operator, $options: 'i' };
      }
      if (query.fromDate || query.toDate) {
        filter.timestamp = {};
        if (query.fromDate) (filter.timestamp as any).$gte = new Date(query.fromDate);
        if (query.toDate) (filter.timestamp as any).$lte = new Date(query.toDate);
      }

      const [items, total] = await Promise.all([
        this.manualModel
          .find(filter)
          .sort({ timestamp: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.manualModel.countDocuments(filter).exec(),
      ]);

      return { total, limit, skip, items };
    }

    // Fallback memoria
    let filtered = [...this.memoryManualRecords];
    if (query.operator) {
      filtered = filtered.filter((r) =>
        r.operator?.toLowerCase().includes(query.operator!.toLowerCase()),
      );
    }
    const items = filtered.slice(skip, skip + limit);
    return { total: filtered.length, limit, skip, items };
  }

  /** Último muestreo manual registrado. */
  async findLatestManual() {
    if (this.manualModel) {
      const latest = await this.manualModel.findOne().sort({ timestamp: -1 }).lean().exec();
      if (latest) return latest;
    }
    return this.latestManualRecord;
  }

  /** Obtiene un muestreo manual por ID. */
  async findManualById(id: string) {
    if (this.manualModel) {
      return this.manualModel.findById(id).lean().exec();
    }
    return this.memoryManualRecords.find((r) => r._id === id || String(r._id) === id) || null;
  }

  /** Guarda una lectura individual simple. */
  async record(
    sensorKey: string,
    value: number,
    source = 'manual',
    operator?: string,
    notes?: string,
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
      recordedBy: operator,
      notes,
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

  /** Estadísticas agregadas por sensor desde una fecha dada. */
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
