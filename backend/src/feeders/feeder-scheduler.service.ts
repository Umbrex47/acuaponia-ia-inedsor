import {
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ActuatorService } from '../actuators/actuator.service';
import {
  FeederSchedule,
  FeederScheduleDocument,
} from './schemas/feeder-schedule.schema';

export interface FeederConfig {
  enabled: boolean;
  times: string[];
  durationMs: number;
  portionG: number;
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

@Injectable()
export class FeederSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(FeederSchedulerService.name);
  private readonly baseId = 'feeder-job';
  private currentConfig: FeederConfig = { enabled: true, times: [], durationMs: 0, portionG: 0 };

  constructor(
    private readonly actuators: ActuatorService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
    @Optional()
    @InjectModel(FeederSchedule.name)
    private readonly model?: Model<FeederScheduleDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    const enabled = this.config.get<boolean>('feeder.enabled', true);
    const timesCsv = this.config.get<string>('feeder.times', '08:00,12:00,17:00');
    const durationMs = this.config.get<number>('feeder.durationMs', 20_000);
    const portionG = this.config.get<number>('feeder.portionG', 15);

    const csvTimes = timesCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (this.model) {
      const persisted = await this.model.findById('default').lean();
      if (persisted) {
        this.currentConfig = {
          enabled,
          times: persisted.times?.length ? persisted.times : csvTimes,
          durationMs: persisted.durationMs || durationMs,
          portionG: persisted.portionG || portionG,
        };
        if (!persisted.times?.length || !persisted.durationMs) {
          await this.model.updateOne(
            { _id: 'default' },
            {
              $set: {
                times: this.currentConfig.times,
                durationMs: this.currentConfig.durationMs,
                portionG: this.currentConfig.portionG,
              },
            },
            { upsert: true },
          );
        }
      } else {
        this.currentConfig = { enabled, times: csvTimes, durationMs, portionG };
        await this.model.create({
          _id: 'default',
          times: csvTimes,
          durationMs,
          portionG,
        });
      }
    } else {
      this.currentConfig = { enabled, times: csvTimes, durationMs, portionG };
    }

    if (!this.currentConfig.enabled) {
      this.logger.warn('FeederScheduler deshabilitado');
      return;
    }

    this.scheduleAll();
  }

  getConfig(): FeederConfig {
    return { ...this.currentConfig };
  }

  async updateSchedule(input: {
    times?: string[];
    durationMs?: number;
    portionG?: number;
  }): Promise<FeederConfig> {
    const times = input.times ?? this.currentConfig.times;
    const err = this.validateTimes(times);
    if (err) throw new Error(err);

    const durationMs = input.durationMs ?? this.currentConfig.durationMs;
    const portionG = input.portionG ?? this.currentConfig.portionG;

    this.currentConfig = { ...this.currentConfig, times, durationMs, portionG };

    if (this.model) {
      await this.model.updateOne(
        { _id: 'default' },
        { $set: { times, durationMs, portionG } },
        { upsert: true },
      );
    }

    this.scheduleAll();
    return this.getConfig();
  }

  async dispenseNow(): Promise<{ ok: boolean; reason?: string }> {
    return this.actuators.execute('dispensador_comida', 'dispense', {
      reason: `Dispensador activado: ${this.currentConfig.portionG} g por ${this.currentConfig.durationMs} ms`,
      actor: 'auto',
    });
  }

  private scheduleAll(): void {
    // Eliminar crones anteriores.
    for (const id of this.scheduler.getCronJobs().keys()) {
      if (id.startsWith(this.baseId)) {
        this.scheduler.deleteCronJob(id);
      }
    }

    for (const time of this.currentConfig.times) {
      const [h, m] = time.split(':');
      const expr = `${m} ${h} * * *`;
      try {
        const job = new CronJob(expr, () => {
          this.logger.log(`⏰ Dispensador programado (${time})`);
          void this.dispenseNow();
        });
        const id = `${this.baseId}-${time.replace(':', '')}`;
        this.scheduler.addCronJob(id, job);
        job.start();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`No se pudo programar ${time}: ${msg}`);
      }
    }

    this.logger.log(
      `FeederScheduler activo: ${this.currentConfig.times.length} horarios, ${this.currentConfig.durationMs} ms, ${this.currentConfig.portionG} g`,
    );
  }

  private validateTimes(times: unknown): string | null {
    if (!Array.isArray(times) || times.length === 0) {
      return 'times debe ser un array con al menos un horario';
    }
    const seen = new Set<string>();
    for (const t of times) {
      if (typeof t !== 'string' || !HHMM.test(t)) {
        return `Horario inválido: ${t}. Usa HH:mm (24h).`;
      }
      if (seen.has(t)) return `Horario duplicado: ${t}`;
      seen.add(t);
    }
    return null;
  }
}
