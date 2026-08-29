import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { NotificationService } from '../notifications/notification.service';
import { evaluateRisk, extractReadings, SENSOR_THRESHOLDS } from '../alerts/thresholds';
import type { RiskLevel } from '../alerts/thresholds';

interface ActiveAlert {
  sensor: string;
  label: string;
  value: number;
  unit: string;
  level: RiskLevel;
  optimal: { min: number; max: number };
  recommendation: string;
}

export interface SystemControlStatus {
  pump: 'on' | 'off' | 'unknown';
  aerator: 'on' | 'off' | 'unknown';
  reason?: string;
}

/**
 * Reporte de alerta temprana y estado del control automático.
 *
 * Analiza cada lectura de sensores entrante, identifica parámetros fuera de
 * rango y genera recomendaciones. Cada `reportIntervalHours` envía un resumen
 * por correo/Telegram/WebSocket con:
 *  - Alertas activas (sensor, valor, umbral, recomendación).
 *  - Estado de los actuadores controlados por IA (bomba/aireador).
 */
@Injectable()
export class EarlyWarningReportService implements OnModuleInit {
  private readonly logger = new Logger(EarlyWarningReportService.name);

  private enabled = true;
  private reportIntervalHours = 6;
  private minSeverity: 'low' | 'high' = 'low';

  private latestAlerts = new Map<string, ActiveAlert>();
  private controlStatus: SystemControlStatus = {
    pump: 'unknown',
    aerator: 'unknown',
  };
  private subscription: Subscription | null = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('decision.enabled', true);
    this.reportIntervalHours = this.config.get<number>('decision.earlyWarning.reportIntervalHours', 6);
    this.minSeverity = this.config.get<'low' | 'high'>('decision.earlyWarning.minSeverity', 'low');

    if (!this.enabled) {
      this.logger.warn('Reporte de alerta temprana deshabilitado');
      return;
    }

    this.subscription = this.mqtt.messages$.subscribe(({ topic, payload }) => {
      this.processMessage(topic, payload);
    });

    const cronExpr = this.config.get<string>('decision.earlyWarning.cron', '0 */6 * * *');
    try {
      const job = new CronJob(cronExpr, () => {
        void this.runNow();
      });
      this.scheduler.addCronJob('aquaponic-early-warning', job);
      job.start();
      this.logger.log(
        `Reporte de alerta temprana programado (cron "${cronExpr}", cada ${this.reportIntervalHours} h)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cron de alerta temprana inválido: ${msg}`);
    }
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /** Genera y envía el reporte de alerta temprana ahora. */
  async runNow(): Promise<{ ok: boolean; reason?: string; alerts: number }> {
    const alerts = Array.from(this.latestAlerts.values());
    const filtered = alerts.filter(
      (a) => this.minSeverity !== 'high' || a.level === 'high',
    );

    if (filtered.length === 0) {
      this.logger.debug('Sin alertas activas; no se envía reporte');
      return { ok: true, alerts: 0 };
    }

    const { text, html, telegramText } = this.format(filtered);
    const subject = '[Aquaponía] Alerta temprana · parámetros fuera de rango';

    await Promise.all([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);

    void this.notifications.emit({
      category: 'early-warning',
      severity: 'warn',
      title: 'Alerta temprana · parámetros fuera de rango',
      message: `${filtered.length} sensor(es) fuera de rango. Revisa correo/Telegram para detalles.`,
      dedupeKey: 'early-warning:report',
      source: 'auto',
      meta: { alerts: filtered },
    });

    this.logger.log(`Reporte de alerta temprana enviado (${filtered.length} alertas)`);
    return { ok: true, alerts: filtered.length };
  }

  getStatus(): { enabled: boolean; reportIntervalHours: number; activeAlerts: number; control: SystemControlStatus } {
    return {
      enabled: this.enabled,
      reportIntervalHours: this.reportIntervalHours,
      activeAlerts: this.latestAlerts.size,
      control: this.controlStatus,
    };
  }

  private processMessage(topic: string, payload: string): void {
    if (topic.includes('/commands/') && topic.includes('aireador')) {
      this.controlStatus.aerator = payload.includes('"action":"on"') ? 'on' : 'off';
      return;
    }
    if (topic.includes('/commands/') && topic.includes('bomba_agua')) {
      this.controlStatus.pump = payload.includes('"action":"on"') ? 'on' : 'off';
      return;
    }

    let data: unknown;
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }

    const readings = extractReadings(data);
    for (const { key, value } of readings) {
      const level = evaluateRisk(key, value);
      if (!level || level === 'stable') {
        this.latestAlerts.delete(key);
        continue;
      }

      const meta = SENSOR_THRESHOLDS[key];
      const recommendation = this.buildRecommendation(key, level, value);
      this.latestAlerts.set(key, {
        sensor: key,
        label: meta.label,
        value,
        unit: meta.unit,
        level,
        optimal: meta.optimal,
        recommendation,
      });
    }
  }

  private buildRecommendation(sensor: string, level: RiskLevel, value: number): string {
    const isLow = level === 'low';
    switch (sensor) {
      case 'ph':
        return isLow
          ? 'pH bajo: aumentar buffering con carbonato de calcio o piedra caliza; monitorear amoníaco.'
          : 'pH alto: verificar acumulación de nutrientes; considerar ajuste gradual con ácido orgánico.';
      case 'oxigeno':
        return isLow
          ? 'Oxígeno bajo: aireador activado automáticamente. Verificar afluencia de agua y densidad de peces.'
          : 'Oxígeno alto: condiciones normales; revisar si hay aireación excesiva.';
      case 'turbiedad':
        return 'Turbidez alta: limpiar filtro mecánico y revisar carga biológica.';
      case 'electroconductividad':
        return isLow
          ? 'EC baja: posible falta de nutrientes; verificar solución nutritiva.'
          : 'EC alta: posible acumulación de sales; hacer cambio parcial de agua.';
      case 'temperatura':
        return isLow
          ? 'Temperatura baja: verificar calefactor/aislamiento.'
          : 'Temperatura alta: aumentar sombra/aireación y verificar refrigeración.';
      case 'nivelAgua':
        return isLow
          ? 'Nivel bajo: reponer agua y revisar fugas; bomba protegida por anti-marcha en seco.'
          : 'Nivel alto: revisar desbordamiento o lluvia.';
      default:
        return `${SENSOR_THRESHOLDS[sensor]?.label ?? sensor} ${isLow ? 'bajo' : 'alto'} (${value}); revisar parámetro.`;
    }
  }

  private format(alerts: ActiveAlert[]) {
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });

    const textLines = alerts.map((a) => {
      const direction = a.level === 'low' ? 'bajo' : 'alto';
      return `• ${a.label}: ${a.value}${a.unit ? ' ' + a.unit : ''} (${direction}) — rango óptimo ${a.optimal.min}–${a.optimal.max}${a.unit}\n  Recomendación: ${a.recommendation}`;
    });

    const text = [
      'Alerta temprana — parámetros fuera de rango',
      '',
      `Control automático: bomba=${this.controlStatus.pump}, aireador=${this.controlStatus.aerator}`,
      '',
      ...textLines,
      '',
      `Generado: ${timestamp}`,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:#D97706;color:#fff;padding:18px 24px">
          <h1 style="margin:0;font-size:18px">Alerta temprana</h1>
        </div>
        <div style="padding:24px;color:#0a0a0a;font-size:14px">
          <p><strong>Control automático:</strong> bomba ${this.controlStatus.pump}, aireador ${this.controlStatus.aerator}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
            <tr style="color:#666;text-align:left">
              <th style="padding:6px;border-bottom:1px solid #eee">Parámetro</th>
              <th style="padding:6px;border-bottom:1px solid #eee">Valor</th>
              <th style="padding:6px;border-bottom:1px solid #eee">Rango</th>
              <th style="padding:6px;border-bottom:1px solid #eee">Recomendación</th>
            </tr>
            ${alerts
              .map((a) => {
                const color = a.level === 'high' ? '#DC2626' : '#2563EB';
                return `
                  <tr>
                    <td style="padding:8px 6px;border-bottom:1px solid #eee">${a.label}</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #eee;font-weight:bold;color:${color}">${a.value}${a.unit}</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #eee">${a.optimal.min}–${a.optimal.max}${a.unit}</td>
                    <td style="padding:8px 6px;border-bottom:1px solid #eee;font-size:12px">${a.recommendation}</td>
                  </tr>`;
              })
              .join('')}
          </table>
          <p style="margin-top:16px;color:#999;font-size:12px">Generado: ${timestamp}</p>
        </div>
      </div>
    `;

    const telegramText = [
      '⚠️ <b>Alerta temprana</b>',
      '',
      `<b>Control automático:</b> bomba=${this.controlStatus.pump}, aireador=${this.controlStatus.aerator}`,
      '',
      ...alerts.map((a) => {
        const direction = a.level === 'low' ? 'bajo' : 'alto';
        return `• <b>${a.label}</b>: ${a.value}${a.unit} (${direction})\n  ${a.recommendation}`;
      }),
      '',
      `<i>${timestamp}</i>`,
    ].join('\n');

    return { text, html, telegramText };
  }
}
