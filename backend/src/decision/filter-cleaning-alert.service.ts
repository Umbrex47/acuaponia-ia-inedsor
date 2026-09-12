import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import { NotificationService } from '../notifications/notification.service';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { evaluateRisk, extractReadings } from '../alerts/thresholds';

interface FilterAlertState {
  /** Número de lecturas consecutivas con turbidez alta. */
  highTurbidityCount: number;
  /** Último timestamp en que se envió una alerta de limpieza. */
  lastAlertAt: number;
}

/**
 * Alertas tempranas de mantenimiento de filtros.
 *
 * Dispara una alerta cuando:
 *  - La turbidez se mantiene alta durante varias lecturas consecutivas (suciedad
 *    acumulada en el filtro mecánico/biológico).
 *  - Han pasado `periodicAlertHours` desde la última alerta (mantenimiento
n *    preventivo programado).
 *
 * No controla actuadores; solo notifica al operador.
 */
@Injectable()
export class FilterCleaningAlertService implements OnModuleInit {
  private readonly logger = new Logger(FilterCleaningAlertService.name);
  private subscription: Subscription | null = null;

  private enabled = true;
  private turbidityThreshold = 25;
  private consecutiveReadings = 3;
  private periodicAlertHours = 168; // 7 días
  private cooldownMs = 300_000; // 5 minutos entre alertas por turbidez

  private readonly state: FilterAlertState = {
    highTurbidityCount: 0,
    lastAlertAt: 0,
  };
  private periodicTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    @Inject(forwardRef(() => NotificationService))
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('decision.enabled', true);
    this.turbidityThreshold = this.config.get<number>('decision.filter.turbidityThreshold', 25);
    this.consecutiveReadings = this.config.get<number>('decision.filter.consecutiveReadings', 3);
    this.periodicAlertHours = this.config.get<number>('decision.filter.periodicAlertHours', 168);
    this.cooldownMs = this.config.get<number>('decision.filter.cooldownMs', 300_000);

    if (!this.enabled) {
      this.logger.warn('Alertas de limpieza de filtros deshabilitadas');
      return;
    }

    // Alerta periódica informativa.
    const periodicMs = this.periodicAlertHours * 3_600_000;
    this.periodicTimer = setInterval(() => {
      void this.sendPeriodicAlert();
    }, periodicMs);

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.processPayload(payload);
    });

    this.logger.log(
      `Alertas de limpieza de filtros activas (turbidez >${this.turbidityThreshold} ${this.consecutiveReadings} veces consecutivas)`,
    );
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
  }

  getStatus() {
    return {
      enabled: this.enabled,
      turbidityThreshold: this.turbidityThreshold,
      consecutiveReadings: this.consecutiveReadings,
      periodicAlertHours: this.periodicAlertHours,
      highTurbidityCount: this.state.highTurbidityCount,
      lastAlertAt: this.state.lastAlertAt
        ? new Date(this.state.lastAlertAt).toISOString()
        : null,
    };
  }

  private processPayload(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const readings = extractReadings(data);
    for (const { key, value } of readings) {
      if (key !== 'turbiedad') continue;

      const level = evaluateRisk(key, value);
      const isHigh = level === 'high' || value > this.turbidityThreshold;

      if (isHigh) {
        this.state.highTurbidityCount += 1;
        this.logger.debug(
          `Turbidez alta detectada (${value} NTU) — contador ${this.state.highTurbidityCount}/${this.consecutiveReadings}`,
        );
      } else {
        if (this.state.highTurbidityCount > 0) {
          this.logger.debug(`Turbidez volvió a normal (${value} NTU)`);
        }
        this.state.highTurbidityCount = 0;
      }

      if (this.state.highTurbidityCount >= this.consecutiveReadings) {
        const now = Date.now();
        if (now - this.state.lastAlertAt >= this.cooldownMs) {
          this.state.lastAlertAt = now;
          this.state.highTurbidityCount = 0;
          void this.sendAlert(value);
        }
      }
    }
  }

  private async sendAlert(currentTurbidity: number): Promise<void> {
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });

    const subject = '[Aquaponía] Revisar filtros · turbidez alta';
    const text = [
      `La turbidez se mantuvo alta durante varias lecturas consecutivas.`,
      ``,
      `Lectura actual: ${currentTurbidity} NTU`,
      `Umbral: ${this.turbidityThreshold} NTU`,
      `Recomendación: limpiar/lavar el filtro mecánico y revisar el biológico.`,
      `Fecha: ${timestamp}`,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:#D97706;color:#fff;padding:18px 24px">
          <h1 style="margin:0;font-size:18px">Revisar filtros</h1>
        </div>
        <div style="padding:24px;color:#0a0a0a;font-size:14px">
          <p>La turbidez se mantuvo alta durante varias lecturas consecutivas.</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666">Lectura actual</td><td style="padding:6px 0;text-align:right;font-weight:bold">${currentTurbidity} NTU</td></tr>
            <tr><td style="padding:6px 0;color:#666">Umbral</td><td style="padding:6px 0;text-align:right;font-weight:bold">${this.turbidityThreshold} NTU</td></tr>
            <tr><td style="padding:6px 0;color:#666">Fecha</td><td style="padding:6px 0;text-align:right">${timestamp}</td></tr>
          </table>
          <p style="margin-top:16px"><strong>Recomendación:</strong> limpiar el filtro mecánico y revisar el biológico.</p>
        </div>
      </div>
    `;

    const telegramText = [
      '⚠️ <b>Revisar filtros</b>',
      '',
      `La turbidez se mantuvo alta: <b>${currentTurbidity} NTU</b>`,
      `Recomendación: limpiar/lavar el filtro mecánico y revisar el biológico.`,
      `<i>${timestamp}</i>`,
    ].join('\n');

    await Promise.all([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);

    void this.notifications.emit({
      category: 'maintenance-alert',
      severity: 'warn',
      title: 'Revisar filtros · turbidez alta',
      message: `Turbidez ${currentTurbidity} NTU durante ${this.consecutiveReadings} lecturas consecutivas. Limpiar filtro mecánico.`,
      dedupeKey: 'filter-cleaning:turbidity',
      source: 'auto',
      meta: {
        sensor: 'turbiedad',
        value: currentTurbidity,
        threshold: this.turbidityThreshold,
      },
    });

    this.logger.log(`Alerta de limpieza de filtros enviada (turbidez ${currentTurbidity} NTU)`);
  }

  private async sendPeriodicAlert(): Promise<void> {
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });

    const subject = '[Aquaponía] Mantenimiento preventivo · filtros';
    const text = [
      `Recordatorio de mantenimiento preventivo.`,
      ``,
      `Revisa y limpia los filtros mecánico y biológico si aún no lo hiciste.`,
      `Fecha: ${timestamp}`,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:#2563EB;color:#fff;padding:18px 24px">
          <h1 style="margin:0;font-size:18px">Mantenimiento preventivo</h1>
        </div>
        <div style="padding:24px;color:#0a0a0a;font-size:14px">
          <p>Recordatorio periódico: revisa y limpia los filtros mecánico y biológico.</p>
          <p style="color:#666">Fecha: ${timestamp}</p>
        </div>
      </div>
    `;

    const telegramText = [
      '🛠️ <b>Mantenimiento preventivo</b>',
      '',
      'Revisa y limpia los filtros mecánico y biológico si aún no lo hiciste.',
      `<i>${timestamp}</i>`,
    ].join('\n');

    await Promise.all([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);

    void this.notifications.emit({
      category: 'maintenance-reminder',
      severity: 'info',
      title: 'Mantenimiento preventivo · filtros',
      message: 'Revisa y limpia los filtros mecánico y biológico.',
      dedupeKey: 'filter-cleaning:periodic',
      source: 'auto',
      meta: { type: 'periodic' },
    });

    this.logger.log('Recordatorio periódico de limpieza de filtros enviado');
  }
}
