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
import { Subject } from 'rxjs';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { NotificationGateway } from './notification.gateway';

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
  /** Clave para anti-spam (si dos notificaciones comparten la misma key y
   *  source dentro del cooldown, se descartan). */
  dedupeKey?: string;
  /** Origen del evento (auto | manual | ia | emergency | user | system). */
  source?: 'auto' | 'manual' | 'ia' | 'emergency' | 'user' | 'system';
}

export interface NotificationRecord extends NotificationPayload {
  id: string;
  ts: string;
}

/**
 * Servicio central de notificaciones. Despacha un mismo evento a múltiples
 * canales según `NOTIFICATIONS_CHANNELS`:
 *   - websocket: broadcast al gateway WS (frontend en tiempo real).
 *   - email:     correo formateado (MailService).
 *   - telegram:  mensaje HTML al bot configurado.
 *
 * Si un canal no está configurado (ej. MAIL_HOST vacío) se omite silenciosamente.
 * Aplica anti-spam por `dedupeKey` + `source` durante `NOTIFICATIONS_COOLDOWN_MS`.
 */
@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private readonly stream$ = new Subject<NotificationRecord>();
  private channels: Set<string> = new Set();
  private cooldownMs = 60_000;
  private lastSentAt = new Map<string, number>();
  private ringBuffer: NotificationRecord[] = [];
  private ringMax = 50;

  constructor(
    private readonly config: ConfigService,
    @Optional()
    @Inject(forwardRef(() => MailService))
    private readonly mail?: MailService,
    @Optional()
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram?: TelegramService,
    @Optional() private readonly gateway?: NotificationGateway,
  ) {}

  onModuleInit(): void {
    const cfg = this.config.get<string[]>('notifications.channels', ['websocket']);
    this.channels = new Set(cfg);
    this.cooldownMs = this.config.get<number>('notifications.cooldownMs', 60_000);
    this.ringMax = this.config.get<number>('notifications.maxQueue', 50);
    this.logger.log(
      `Canales activos: ${[...this.channels].join(', ') || '(ninguno)'}`,
    );
  }

  onModuleDestroy(): void {
    this.stream$.complete();
  }

  /** Stream RxJS para suscriptores internos (otros servicios pueden escuchar). */
  get stream() {
    return this.stream$.asObservable();
  }

  /** Últimas N notificaciones (para endpoints REST o sincronización inicial). */
  list(limit = 50): NotificationRecord[] {
    return this.ringBuffer.slice(-limit);
  }

  /** Emite una notificación a todos los canales activos. */
  async emit(payload: NotificationPayload): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
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

    // Ring buffer (memoria)
    this.ringBuffer.push(record);
    if (this.ringBuffer.length > this.ringMax) this.ringBuffer.shift();

    // Stream interno
    this.stream$.next(record);

    // Despacho por canal
    const tasks: Array<Promise<unknown>> = [];

    if (this.channels.has('websocket')) {
      tasks.push(Promise.resolve(this.gateway?.broadcastNotification(record)));
    }
    if (this.channels.has('email')) {
      tasks.push(this.sendEmail(record));
    }
    if (this.channels.has('telegram')) {
      tasks.push(this.sendTelegram(record));
    }

    await Promise.allSettled(tasks);
    return record;
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