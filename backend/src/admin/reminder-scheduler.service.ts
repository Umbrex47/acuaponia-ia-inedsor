import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import {
  ScheduledReminder,
  ScheduledReminderDocument,
} from './schemas/scheduled-reminder.schema';
import {
  CreateReminderDto,
  UpdateReminderDto,
} from './dto/create-reminder.dto';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ReminderSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ReminderSchedulerService.name);
  private memoryReminders: any[] = [];

  constructor(
    @Optional()
    @InjectModel(ScheduledReminder.name)
    private readonly model?: Model<ScheduledReminderDocument>,

    @Optional()
    @Inject(forwardRef(() => NotificationService))
    private readonly notifications?: NotificationService,
  ) {}

  async onModuleInit() {
    // Si la base de datos está vacía, inicializar un recordatorio por defecto cada 3 días
    await this.seedDefaultRemindersIfEmpty();
  }

  private async seedDefaultRemindersIfEmpty() {
    const defaultReminder = {
      id: 'default-sampling-reminder',
      title: 'Muestreo de Calidad de Agua (Nitritos, Amonio, pH)',
      description: 'Recordatorio periódico cada 3 días: Verificar parámetros químicos críticos mediante la app móvil.',
      type: 'recurring',
      intervalDays: 3,
      targetTime: '08:00',
      targetVariables: ['nitritos', 'amonio', 'ph', 'nitratos'],
      targetRole: 'todos',
      severity: 'warn',
      enabled: true,
      nextTriggerAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      createdBy: 'Admin Sistema',
    };

    if (this.model) {
      const count = await this.model.countDocuments().exec();
      if (count === 0) {
        await this.model.create(defaultReminder);
        this.logger.log('Recordatorio predeterminado creado (cada 3 días)');
      }
    } else {
      if (this.memoryReminders.length === 0) {
        this.memoryReminders.push(defaultReminder);
      }
    }
  }

  /**
   * Cron job que se ejecuta cada 5 minutos comprobando si alguna alerta
   * o recordatorio programado ha llegado a su fecha de disparo.
   */
  @Cron('*/5 * * * *')
  async checkAndDispatchReminders() {
    const now = new Date();
    this.logger.debug(`Verificando recordatorios programados a las ${now.toLocaleTimeString()}`);

    let dueReminders: any[] = [];

    if (this.model) {
      dueReminders = await this.model
        .find({
          enabled: true,
          nextTriggerAt: { $lte: now },
        })
        .exec();
    } else {
      dueReminders = this.memoryReminders.filter(
        (r) => r.enabled && new Date(r.nextTriggerAt) <= now,
      );
    }

    for (const reminder of dueReminders) {
      await this.dispatchReminder(reminder, now);
    }
  }

  /** Dispara la notificación y recalcula la próxima fecha de alerta. */
  async dispatchReminder(reminder: any, triggerTime = new Date()) {
    const varList = Array.isArray(reminder.targetVariables) && reminder.targetVariables.length > 0
      ? reminder.targetVariables.join(', ')
      : 'parámetros de agua';

    this.logger.log(`Disparando recordatorio: "${reminder.title}"`);

    // 1. Emitir notificación multicanal (WebSocket, Push celular, etc.)
    if (this.notifications) {
      await this.notifications.emit({
        category: 'maintenance-reminder',
        severity: (reminder.severity as any) || 'warn',
        title: `⏰ Recordatorio: ${reminder.title}`,
        message:
          reminder.description ||
          `Es momento de volver a chequear ${varList} en el estanque y registrar los datos en la app.`,
        source: 'system',
        meta: {
          reminderId: reminder.id,
          targetVariables: reminder.targetVariables,
          intervalDays: reminder.intervalDays,
          type: reminder.type,
        },
      });
    }

    // 2. Recalcular próxima fecha
    let nextDate: Date;
    let keepEnabled = reminder.enabled;

    if (reminder.type === 'once') {
      keepEnabled = false; // Alerta de fecha única se desactiva tras disparar
      nextDate = triggerTime;
    } else {
      // Recurrente: sumar N días (ej: cada 3 días)
      const days = Number(reminder.intervalDays) || 3;
      nextDate = new Date(triggerTime.getTime() + days * 24 * 60 * 60 * 1000);

      // Ajustar hora deseada si fue provista (HH:mm)
      if (reminder.targetTime && reminder.targetTime.includes(':')) {
        const [hours, minutes] = reminder.targetTime.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          nextDate.setHours(hours, minutes, 0, 0);
        }
      }
    }

    if (this.model) {
      await this.model.updateOne(
        { id: reminder.id },
        {
          lastTriggeredAt: triggerTime,
          nextTriggerAt: nextDate,
          enabled: keepEnabled,
        },
      );
    } else {
      reminder.lastTriggeredAt = triggerTime;
      reminder.nextTriggerAt = nextDate;
      reminder.enabled = keepEnabled;
    }
  }

  /** Crear un nuevo recordatorio o fecha de alerta. */
  async createReminder(dto: CreateReminderDto, createdBy = 'Admin') {
    const id = `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date();

    let nextTriggerAt: Date;
    if (dto.type === 'once' && dto.specificDate) {
      nextTriggerAt = new Date(dto.specificDate);
    } else {
      const days = Number(dto.intervalDays) || 3;
      nextTriggerAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      if (dto.targetTime && dto.targetTime.includes(':')) {
        const [h, m] = dto.targetTime.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) nextTriggerAt.setHours(h, m, 0, 0);
      }
    }

    const doc = {
      id,
      title: dto.title,
      description: dto.description || '',
      type: dto.type || 'recurring',
      intervalDays: Number(dto.intervalDays) || 3,
      targetTime: dto.targetTime || '08:00',
      specificDate: dto.specificDate ? new Date(dto.specificDate) : undefined,
      targetVariables: dto.targetVariables || ['nitritos', 'amonio', 'ph', 'nitratos'],
      targetRole: dto.targetRole || 'todos',
      severity: dto.severity || 'warn',
      enabled: dto.enabled ?? true,
      nextTriggerAt,
      createdBy,
    };

    if (this.model) {
      return this.model.create(doc);
    } else {
      this.memoryReminders.push(doc);
      return doc;
    }
  }

  /** Listar todos los recordatorios programados. */
  async listReminders() {
    if (this.model) {
      return this.model.find().sort({ enabled: -1, nextTriggerAt: 1 }).lean().exec();
    }
    return this.memoryReminders;
  }

  /** Actualizar un recordatorio. */
  async updateReminder(id: string, dto: UpdateReminderDto) {
    if (this.model) {
      const existing = await this.model.findOne({ id });
      if (!existing) return null;

      if (dto.intervalDays && dto.intervalDays !== existing.intervalDays) {
        existing.nextTriggerAt = new Date(
          Date.now() + Number(dto.intervalDays) * 24 * 60 * 60 * 1000,
        );
      }

      Object.assign(existing, dto);
      return existing.save();
    } else {
      const item = this.memoryReminders.find((r) => r.id === id);
      if (item) Object.assign(item, dto);
      return item;
    }
  }

  /** Eliminar un recordatorio. */
  async deleteReminder(id: string) {
    if (this.model) {
      await this.model.deleteOne({ id }).exec();
    } else {
      this.memoryReminders = this.memoryReminders.filter((r) => r.id !== id);
    }
    return { success: true, id };
  }

  /** Forzar disparo de prueba inmediato. */
  async triggerNow(id: string) {
    let reminder: any = null;
    if (this.model) {
      reminder = await this.model.findOne({ id }).exec();
    } else {
      reminder = this.memoryReminders.find((r) => r.id === id);
    }

    if (!reminder) {
      return { success: false, message: 'Recordatorio no encontrado' };
    }

    await this.dispatchReminder(reminder, new Date());
    return { success: true, message: `Recordatorio "${reminder.title}" enviado exitosamente` };
  }
}
