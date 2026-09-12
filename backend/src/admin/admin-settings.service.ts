import {
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SystemSettings,
  SystemSettingsDocument,
} from './schemas/system-settings.schema';
import { UpdateSettingsDto } from './dto/create-reminder.dto';
import { SENSOR_THRESHOLDS } from '../alerts/thresholds';

@Injectable()
export class AdminSettingsService implements OnModuleInit {
  private readonly logger = new Logger(AdminSettingsService.name);
  private memorySettings: any = {
    key: 'global',
    notificationChannels: ['websocket', 'push'],
    cooldownMinutes: 60,
    defaultSamplingDays: 3,
    customThresholds: {},
    adminPasscode: 'admin123',
    updatedBy: 'Sistema',
  };

  constructor(
    @Optional()
    @InjectModel(SystemSettings.name)
    private readonly model?: Model<SystemSettingsDocument>,
  ) {}

  async onModuleInit() {
    if (this.model) {
      const existing = await this.model.findOne({ key: 'global' }).exec();
      if (!existing) {
        await this.model.create(this.memorySettings);
        this.logger.log('Ajustes globales de sistema inicializados en MongoDB');
      }
    }
  }

  /** Obtiene la configuración actual del sistema y notificaciones. */
  async getSettings() {
    let settings: any = null;
    if (this.model) {
      settings = await this.model.findOne({ key: 'global' }).lean().exec();
    }
    if (!settings) settings = this.memorySettings;

    return {
      ...settings,
      systemThresholds: SENSOR_THRESHOLDS,
    };
  }

  /** Actualiza los ajustes de notificación, umbrales y tiempos de alerta. */
  async updateSettings(dto: UpdateSettingsDto, adminUser = 'Administrador') {
    this.logger.log(`Ajustes actualizados por: ${adminUser}`);

    if (this.model) {
      const updated = await this.model.findOneAndUpdate(
        { key: 'global' },
        {
          ...dto,
          updatedBy: adminUser,
          updatedAt: new Date(),
        },
        { upsert: true, new: true },
      );
      return updated;
    } else {
      Object.assign(this.memorySettings, dto, {
        updatedBy: adminUser,
        updatedAt: new Date(),
      });
      return this.memorySettings;
    }
  }
}
