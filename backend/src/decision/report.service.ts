import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import { SchedulerRegistry } from '@nestjs/schedule';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { ReadingsService, SensorStat } from '../readings/readings.service';

/** Tendencia de un sensor frente a la ventana anterior. */
type Trend = 'up' | 'down' | 'flat';

interface SensorAnalysis extends SensorStat {
  trend: Trend;
  deltaAvg: number;
  outOfRangePct: number;
}

export interface ReportResult {
  ok: boolean;
  reason?: string;
  windowHours?: number;
  sensors?: number;
}

/**
 * Genera un reporte de progreso del sistema a partir del histórico en MongoDB
 * y lo envía por correo + Telegram. Se ejecuta de forma programada (cron) y
 * también a demanda.
 *
 * El método `analyze()` es el punto de extensión de la fase 2: hoy calcula
 * estadísticas y tendencia simple; ahí se puede enchufar un modelo de
 * predicción/anomalías sin tocar el formateo ni el envío.
 */
@Injectable()
export class ReportService implements OnModuleInit {
  private readonly logger = new Logger(ReportService.name);
  private enabled = true;
  private windowHours = 24;

  constructor(
    private readonly readings: ReadingsService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const decisionEnabled = this.config.get<boolean>('decision.enabled', true);
    this.enabled = decisionEnabled && this.config.get<boolean>('decision.report.enabled', true);
    this.windowHours = this.config.get<number>('decision.report.windowHours', 24);

    if (!this.enabled) {
      this.logger.warn('Reporte de progreso deshabilitado');
      return;
    }

    const cronExpr = this.config.get<string>('decision.report.cron', '0 8 * * *');
    try {
      const job = new CronJob(cronExpr, () => {
        void this.runNow();
      });
      this.scheduler.addCronJob('aquaponic-report', job);
      job.start();
      this.logger.log(`Reporte de progreso programado (cron "${cronExpr}")`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Cron de reporte inválido ("${cronExpr}"): ${msg}`);
    }
  }

  /** Genera y envía el reporte ahora. Devuelve un resumen del resultado. */
  async runNow(windowHours = this.windowHours): Promise<ReportResult> {
    if (!this.readings.isEnabled) {
      return {
        ok: false,
        reason: 'El histórico no está disponible (configura MONGODB_URI)',
      };
    }

    const analysis = await this.analyze(windowHours);
    if (analysis.length === 0) {
      return { ok: false, reason: 'Sin lecturas en la ventana analizada', windowHours };
    }

    const subject = `[Aquaponía] Reporte de progreso (${windowHours} h)`;
    const { text, html, telegramText } = this.format(analysis, windowHours);

    await Promise.all([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);

    this.logger.log(`Reporte de progreso enviado (${analysis.length} sensores)`);
    return { ok: true, windowHours, sensors: analysis.length };
  }

  /**
   * Punto de extensión (fase 2): combina estadísticas de la ventana actual con
   * la anterior para derivar tendencia. Aquí se puede sumar forecasting/ML.
   */
  private async analyze(windowHours: number): Promise<SensorAnalysis[]> {
    const now = Date.now();
    const windowMs = windowHours * 3_600_000;
    const since = new Date(now - windowMs);
    const prevSince = new Date(now - 2 * windowMs);

    const [current, previous] = await Promise.all([
      this.readings.statsSince(since),
      this.readings.statsSince(prevSince),
    ]);

    const prevByKey = new Map<string, SensorStat>();
    for (const stat of previous) {
      // statsSince(prevSince) incluye ambas ventanas; aproximamos la previa con
      // su promedio global, suficiente para una flecha de tendencia.
      prevByKey.set(stat.sensorKey, stat);
    }

    return current.map((stat) => {
      const prev = prevByKey.get(stat.sensorKey);
      const deltaAvg = prev ? stat.avg - prev.avg : 0;
      const threshold = Math.abs(stat.avg) * 0.02; // 2% para considerar cambio
      const trend: Trend =
        deltaAvg > threshold ? 'up' : deltaAvg < -threshold ? 'down' : 'flat';
      const outOfRangePct = stat.count
        ? Math.round(((stat.low + stat.high) / stat.count) * 100)
        : 0;
      return { ...stat, trend, deltaAvg, outOfRangePct };
    });
  }

  private format(rows: SensorAnalysis[], windowHours: number) {
    const arrow: Record<Trend, string> = { up: '↑', down: '↓', flat: '→' };
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

    const totalOut = rows.reduce((acc, r) => acc + r.low + r.high, 0);
    const headline =
      totalOut === 0
        ? 'Todos los parámetros se mantuvieron en rango.'
        : `${totalOut} lecturas fuera de rango en el periodo.`;

    const textLines = rows.map((r) => {
      const unit = r.unit ? ` ${r.unit}` : '';
      return `• ${r.label}: prom ${fmt(r.avg)}${unit} ${arrow[r.trend]} (min ${fmt(r.min)} / max ${fmt(r.max)}) · fuera de rango ${r.outOfRangePct}%`;
    });

    const text = [
      `Reporte de progreso — últimas ${windowHours} h`,
      headline,
      ``,
      ...textLines,
      ``,
      `Generado: ${timestamp}`,
    ].join('\n');

    const htmlRows = rows
      .map((r) => {
        const unit = r.unit ? ` ${r.unit}` : '';
        const outColor = r.outOfRangePct > 0 ? '#DC2626' : '#16A34A';
        return `
          <tr>
            <td style="padding:8px 6px;border-top:1px solid #eee">${r.label}</td>
            <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right">${fmt(r.avg)}${unit} ${arrow[r.trend]}</td>
            <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;color:#666">${fmt(r.min)} – ${fmt(r.max)}</td>
            <td style="padding:8px 6px;border-top:1px solid #eee;text-align:right;color:${outColor};font-weight:bold">${r.outOfRangePct}%</td>
          </tr>`;
      })
      .join('');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:#0a0a0a;color:#fff;padding:18px 24px">
          <h1 style="margin:0;font-size:18px">Reporte de progreso · ${windowHours} h</h1>
        </div>
        <div style="padding:24px;color:#0a0a0a;font-size:14px">
          <p style="margin:0 0 16px">${headline}</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="color:#666;text-align:left">
              <th style="padding:6px;text-align:left">Parámetro</th>
              <th style="padding:6px;text-align:right">Promedio</th>
              <th style="padding:6px;text-align:right">Min – Max</th>
              <th style="padding:6px;text-align:right">Fuera</th>
            </tr>
            ${htmlRows}
          </table>
          <p style="margin:16px 0 0;color:#999;font-size:12px">Generado: ${timestamp}</p>
        </div>
      </div>
    `;

    const telegramText = [
      `📊 <b>Reporte de progreso · ${windowHours} h</b>`,
      headline,
      ``,
      ...rows.map((r) => {
        const unit = r.unit ? ` ${r.unit}` : '';
        return `${arrow[r.trend]} <b>${r.label}:</b> ${fmt(r.avg)}${unit} (min ${fmt(r.min)} / max ${fmt(r.max)}) · fuera ${r.outOfRangePct}%`;
      }),
      ``,
      `<i>Generado: ${timestamp}</i>`,
    ].join('\n');

    return { text, html, telegramText };
  }
}
