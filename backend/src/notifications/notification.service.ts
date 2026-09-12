import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subject } from 'rxjs';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { NotificationGateway } from './notification.gateway';
import {
  NotificationLog,
  NotificationLogDocument,
} from './schemas/notification-log.schema';
import {
  PushSubscription,
  PushSubscriptionDocument,
} from './schemas/push-subscription.schema';

export type NotificationSeverity = 'info' | 'warn' | 'critical' | 'success';

export type NotificationCategory =
  | 'sensor-alert'
  | 'sensor-recovered'
  | 'actuator-change'
  | 'system'
  | 'assistant'
  | 'feeder'
  | 'early-warning'
  | 'early-warning-active'
  | 'ia-decision'
  | 'ia-recovery'
  | 'ia-report'
  | 'maintenance-alert'
  | 'maintenance-reminder';

export interface NotificationPayload {
  /** Categoría del evento. */
  category: NotificationCategory;
  /** Severidad (color/emoji en UI). */
  severity: NotificationSeverity;
  /** Título corto. */
  title: string;
  /** Mensaje legible (1-2 frases). */
  message: string;
  /** Datos extra arbitrarios (lectura, valor, etc.). */
  meta?: Record<string, unknown>;
  /** Clave para anti-spam. */
  dedupeKey?: string;
  /** Origen del evento (auto | manual | ia | emergency | user | system). */
  source?: 'auto' | 'manual' | 'ia' | 'emergency' | 'user' | 'system';
}

export interface NotificationRecord extends NotificationPayload {
  id: string;
  ts: string;
  read?: boolean;
}

/**
 * Servicio central y robusto de notificaciones.
 * Despacha eventos a múltiples canales:
 *   - websocket: broadcast al gateway WS (dashboard y app móvil).
 *   - push: notificaciones Push a dispositivos móviles (Expo Push API / FCM).
 *   - email: correo formateado (MailService).
 *   - telegram: bot de Telegram.
 *   - persistencia: MongoDB (NotificationLog) para historial y acuses de recibo.
 */
@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private readonly stream$ = new Subject<NotificationRecord>();
  private channels: Set<string> = new Set();
  private cooldownMs = 60_000;
  private lastSentAt = new Map<string, number>();
  private ringBuffer: NotificationRecord[] = [];
  private ringMax = 100;

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(forwardRef(() => MailService))
    private readonly mail?: MailService,
    @Optional()
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram?: TelegramService,
    @Optional() private readonly gateway?: NotificationGateway,

    @Optional()
    @InjectModel(NotificationLog.name)
    private readonly logModel?: Model<NotificationLogDocument>,

    @Optional()
    @InjectModel(PushSubscription.name)
    private readonly pushModel?: Model<PushSubscriptionDocument>,
  ) {}

  onModuleInit(): void {
    const cfg = this.config.get<string[]>('notifications.channels', [
      'websocket',
      'push',
    ]);
    this.channels = new Set(cfg);
    this.cooldownMs = this.config.get<number>('notifications.cooldownMs', 60_000);
    this.ringMax = this.config.get<number>('notifications.maxQueue', 100);
    this.logger.log(
      `Canales de notificación activos: ${[...this.channels].join(', ') || '(ninguno)'}`,
    );
  }

  onModuleDestroy(): void {
    this.stream$.complete();
  }

  /** Stream RxJS para suscriptores internos. */
  get stream() {
    return this.stream$.asObservable();
  }

  /** Emite una notificación a todos los canales activos y la persiste. */
  async emit(payload: NotificationPayload): Promise<NotificationRecord> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const record: NotificationRecord = {
      ...payload,
      id,
      ts: nowIso,
      read: false,
      source: payload.source ?? 'system',
    };

    // Anti-spam por (dedupeKey + source)
    if (record.dedupeKey) {
      const key = `${record.source}:${record.dedupeKey}`;
      const now = Date.now();
      const last = this.lastSentAt.get(key) ?? 0;
      if (now - last < this.cooldownMs) {
        this.logger.debug(`Notificación suprimida por cooldown: ${key}`);
        return record;
      }
      this.lastSentAt.set(key, now);
    }

    // Guardar en ring buffer en memoria
    this.ringBuffer.unshift(record);
    if (this.ringBuffer.length > this.ringMax) this.ringBuffer.pop();

    // Persistir en MongoDB si está disponible
    if (this.logModel) {
      try {
        await this.logModel.create({
          id: record.id,
          category: record.category,
          severity: record.severity,
          title: record.title,
          message: record.message,
          meta: record.meta || {},
          source: record.source,
          ts: new Date(nowIso),
          read: false,
        });
      } catch (err) {
        this.logger.error(`Error guardando log de notificación: ${(err as Error).message}`);
      }
    }

    // Stream interno
    this.stream$.next(record);

    // Despacho por canales concurrentes
    const tasks: Array<Promise<unknown>> = [];

    // 1. WebSocket a móviles y web dashboard
    tasks.push(Promise.resolve(this.gateway?.broadcastNotification(record)));

    // 2. Notificaciones Push Móviles
    tasks.push(this.dispatchMobilePush(record));

    // 3. Email
    if (this.channels.has('email')) {
      tasks.push(this.sendEmail(record));
    }

    // 4. Telegram
    if (this.channels.has('telegram')) {
      tasks.push(this.sendTelegram(record));
    }

    await Promise.allSettled(tasks);
    return record;
  }

  /**
   * Envía push notification a los dispositivos registrados en la app móvil.
   * Utiliza el servicio de notificaciones de Expo Push o FCM.
   */
  private async dispatchMobilePush(record: NotificationRecord): Promise<void> {
    if (!this.pushModel) return;

    try {
      const subscriptions = await this.pushModel.find({ active: true }).lean().exec();
      if (!subscriptions || subscriptions.length === 0) return;

      const expoTokens = subscriptions
        .map((s) => s.token)
        .filter((token) => token && token.startsWith('ExponentPushToken['));

      if (expoTokens.length === 0) return;

      const emoji = this.emoji(record.severity);
      const messages = expoTokens.map((to) => ({
        to,
        sound: 'default',
        title: `${emoji} ${record.title}`,
        body: record.message,
        data: {
          notificationId: record.id,
          severity: record.severity,
          category: record.category,
          meta: record.meta,
        },
        priority: record.severity === 'critical' ? 'high' : 'normal',
      }));

      // Envío en lotes al endpoint de Expo Push
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.warn(`Expo push respondió status ${response.status}`);
      }
    } catch (err) {
      this.logger.warn(`Fallo al enviar push móvil: ${(err as Error).message}`);
    }
  }

  /** Registra el token de notificaciones push de un celular. */
  async registerPushSubscription(dto: {
    token: string;
    platform?: string;
    deviceName?: string;
    userName?: string;
  }) {
    if (!dto.token) return { success: false, message: 'Token requerido' };

    if (this.pushModel) {
      await this.pushModel.findOneAndUpdate(
        { token: dto.token },
        {
          token: dto.token,
          platform: dto.platform || 'expo',
          deviceName: dto.deviceName || 'Dispositivo móvil',
          userName: dto.userName,
          active: true,
          lastActiveAt: new Date(),
        },
        { upsert: true, new: true },
      );
    }
    return { success: true, message: 'Dispositivo registrado para notificaciones push' };
  }

  /** Lista notificaciones con filtros y paginación. */
  async listNotifications(query: {
    unreadOnly?: boolean;
    severity?: NotificationSeverity;
    limit?: number;
    skip?: number;
  }) {
    const limit = Math.min(Math.max(query.limit ? Number(query.limit) : 50, 1), 200);
    const skip = Math.max(query.skip ? Number(query.skip) : 0, 0);

    if (this.logModel) {
      const filter: Record<string, unknown> = {};
      if (query.unreadOnly) filter.read = false;
      if (query.severity) filter.severity = query.severity;

      const [items, total, unread] = await Promise.all([
        this.logModel.find(filter).sort({ ts: -1 }).skip(skip).limit(limit).lean().exec(),
        this.logModel.countDocuments(filter).exec(),
        this.logModel.countDocuments({ read: false }).exec(),
      ]);

      return { total, unread, limit, skip, items };
    }

    // Fallback memoria
    let filtered = [...this.ringBuffer];
    if (query.unreadOnly) filtered = filtered.filter((n) => !n.read);
    if (query.severity) filtered = filtered.filter((n) => n.severity === query.severity);

    const items = filtered.slice(skip, skip + limit);
    const unread = this.ringBuffer.filter((n) => !n.read).length;
    return { total: filtered.length, unread, limit, skip, items };
  }

  /** Cantidad de alertas no leídas. */
  async countUnread(): Promise<number> {
    if (this.logModel) {
      return this.logModel.countDocuments({ read: false }).exec();
    }
    return this.ringBuffer.filter((n) => !n.read).length;
  }

  /** Marcar una notificación como leída. */
  async markAsRead(id: string, readBy?: string) {
    if (this.logModel) {
      await this.logModel.updateOne(
        { id },
        { read: true, readAt: new Date(), readBy: readBy || 'mobile-user' },
      );
    }
    const mem = this.ringBuffer.find((n) => n.id === id);
    if (mem) mem.read = true;
    return { success: true, id };
  }

  /** Marcar todas como leídas. */
  async markAllAsRead(readBy?: string) {
    if (this.logModel) {
      await this.logModel.updateMany(
        { read: false },
        { read: true, readAt: new Date(), readBy: readBy || 'mobile-user' },
      );
    }
    this.ringBuffer.forEach((n) => (n.read = true));
    return { success: true };
  }

  /** Últimas N notificaciones (compatibilidad retroactiva). */
  list(limit = 50): NotificationRecord[] {
    return this.ringBuffer.slice(0, limit);
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  private buildEmail(record: NotificationRecord): { subject: string; text: string; html: string } {
    const accent = this.accentColor(record.severity);
    const emoji = this.emoji(record.severity);
    const subject = `[Aquaponía] ${emoji} ${record.title}`;
    const text = [
      `${record.title}`,
      ``,
      record.message,
      ``,
      `Categoría: ${record.category}`,
      `Severidad: ${record.severity}`,
      `Origen: ${record.source}`,
      `Fecha: ${record.ts}`,
    ].join('\n');
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:${accent};color:#fff;padding:16px 22px">
          <h2 style="margin:0;font-size:16px">${emoji} ${record.title}</h2>
        </div>
        <div style="padding:22px;color:#0a0a0a;font-size:14px">
          <p style="margin:0 0 14px">${record.message}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#444">
            <tr><td style="padding:4px 0">Categoría</td><td style="text-align:right">${record.category}</td></tr>
            <tr><td style="padding:4px 0">Severidad</td><td style="text-align:right">${record.severity}</td></tr>
            <tr><td style="padding:4px 0">Origen</td><td style="text-align:right">${record.source}</td></tr>
            <tr><td style="padding:4px 0">Fecha</td><td style="text-align:right">${record.ts}</td></tr>
          </table>
        </div>
      </div>`;
    return { subject, text, html };
  }

  private async sendEmail(record: NotificationRecord): Promise<void> {
    if (!this.mail?.isEnabled) return;
    try {
      const msg = this.buildEmail(record);
      await this.mail.send(msg);
    } catch (err) {
      this.logger.warn(`email falló: ${(err as Error).message}`);
    }
  }

  private async sendTelegram(record: NotificationRecord): Promise<void> {
    if (!this.telegram?.isEnabled) return;
    try {
      const emoji = this.emoji(record.severity);
      const text = [
        `${emoji} <b>${record.title}</b>`,
        ``,
        record.message,
        ``,
        `<b>Categoría:</b> ${record.category}`,
        `<b>Severidad:</b> ${record.severity}`,
        `<b>Origen:</b> ${record.source}`,
      ].join('\n');
      await this.telegram.send({ text });
    } catch (err) {
      this.logger.warn(`telegram falló: ${(err as Error).message}`);
    }
  }

  private emoji(s: NotificationSeverity): string {
    return s === 'critical' ? '🔴' : s === 'warn' ? '🟡' : s === 'success' ? '🟢' : 'ℹ️';
  }
  private accentColor(s: NotificationSeverity): string {
    return s === 'critical' ? '#DC2626' : s === 'warn' ? '#D97706' : s === 'success' ? '#16A34A' : '#2563EB';
  }
}