import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { MqttService } from '../mqtt/mqtt.service';
import { MailService } from './mail.service';
import { TelegramService } from './telegram.service';
import {
  evaluateRisk,
  extractReadings,
  RISK_LABELS,
  RiskLevel,
  SENSOR_THRESHOLDS,
} from './thresholds';

interface SensorState {
  level: RiskLevel;
  value: number;
  lastAlertAt: number;
}

@Injectable()
export class AlertService implements OnModuleInit {
  private readonly logger = new Logger(AlertService.name);
  private subscription: Subscription | null = null;

  /** Último estado conocido por sensor, para detectar el cruce de umbral. */
  private readonly state = new Map<string, SensorState>();

  constructor(
    private readonly mqtt: MqttService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('alerts.enabled', true)) {
      this.logger.warn('Alertas deshabilitadas (ALERTS_ENABLED=false)');
      return;
    }

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.processPayload(payload);
    });

    this.logger.log('Servicio de alertas activo — vigilando umbrales');
  }

  private processPayload(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return; // payload no JSON: lo ignoramos
    }

    const readings = extractReadings(data);
    if (readings.length === 0) return;

    for (const { key, value } of readings) {
      const level = evaluateRisk(key, value);
      if (!level) continue;
      this.handleReading(key, value, level);
    }
  }

  /**
   * Evalúa lecturas provenientes de una acción explícita del usuario
   * (formulario de parámetros). A diferencia del flujo automático, aquí
   * forzamos el envío de cualquier valor fuera de rango aunque ya estuviera
   * en ese estado (respetando el cooldown anti-spam).
   * Devuelve cuántos sensores se evaluaron y cuántos salieron de rango.
   */
  notifyManual(data: unknown): { evaluated: number; outOfRange: number } {
    const readings = extractReadings(data);
    let outOfRange = 0;

    for (const { key, value } of readings) {
      const level = evaluateRisk(key, value);
      if (!level) continue;
      if (level !== 'stable') outOfRange += 1;
      this.handleReading(key, value, level, { force: true, source: 'manual' });
    }

    return { evaluated: readings.length, outOfRange };
  }

  private handleReading(
    key: string,
    value: number,
    level: RiskLevel,
    opts: { force?: boolean; source?: 'auto' | 'manual' } = {},
  ): void {
    const { force = false, source = 'auto' } = opts;
    const prev = this.state.get(key);
    const prevLevel = prev?.level ?? 'stable';

    // Solo nos interesa el momento en que el nivel cambia.
    const changed = level !== prevLevel;

    // Disparamos correo al cruzar FUERA del rango estable. En modo forzado
    // (envío manual) basta con estar fuera de rango, aunque no haya cambio.
    const crossedThreshold =
      level !== 'stable' && (force || changed);

    let lastAlertAt = prev?.lastAlertAt ?? 0;

    if (crossedThreshold) {
      const cooldownMs = this.config.get<number>('alerts.cooldownMs', 300000);
      const now = Date.now();
      if (now - lastAlertAt >= cooldownMs) {
        lastAlertAt = now;
        void this.sendAlert(key, value, level, source);
      } else {
        this.logger.debug(
          `Alerta de ${key} omitida por cooldown (${RISK_LABELS[level]})`,
        );
      }
    } else if (changed && level === 'stable') {
      this.logger.log(`${SENSOR_THRESHOLDS[key].label} volvió a estable`);
    }

    this.state.set(key, { level, value, lastAlertAt });
  }

  private async sendAlert(
    key: string,
    value: number,
    level: RiskLevel,
    source: 'auto' | 'manual' = 'auto',
  ): Promise<void> {
    const meta = SENSOR_THRESHOLDS[key];
    const riskLabel = RISK_LABELS[level];
    const direction = level === 'high' ? 'por encima' : 'por debajo';
    const unit = meta.unit ? ` ${meta.unit}` : '';
    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });

    const origin =
      source === 'manual' ? 'Ingreso manual de parámetros' : 'Telemetría automática';

    const subject = `[Aquaponía] ${riskLabel}: ${meta.label} fuera de rango`;

    const text = [
      `Alerta del sistema acuapónico`,
      ``,
      `Parámetro: ${meta.label}`,
      `Lectura: ${value}${unit}`,
      `Estado: ${riskLabel} (${direction} del rango óptimo)`,
      `Rango óptimo: ${meta.optimal.min} – ${meta.optimal.max}${unit}`,
      `Origen: ${origin}`,
      `Fecha: ${timestamp}`,
    ].join('\n');

    const accent = level === 'high' ? '#DC2626' : '#2563EB';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:${accent};color:#fff;padding:18px 24px">
          <h1 style="margin:0;font-size:18px">Alerta del sistema acuapónico</h1>
        </div>
        <div style="padding:24px;color:#0a0a0a">
          <p style="margin:0 0 16px;font-size:15px">
            El parámetro <strong>${meta.label}</strong> cruzó el umbral estable.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#666">Lectura actual</td>
                <td style="padding:6px 0;text-align:right;font-weight:bold">${value}${unit}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Estado</td>
                <td style="padding:6px 0;text-align:right;font-weight:bold;color:${accent}">${riskLabel} (${direction})</td></tr>
            <tr><td style="padding:6px 0;color:#666">Rango óptimo</td>
                <td style="padding:6px 0;text-align:right">${meta.optimal.min} – ${meta.optimal.max}${unit}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Origen</td>
                <td style="padding:6px 0;text-align:right">${origin}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Fecha</td>
                <td style="padding:6px 0;text-align:right">${timestamp}</td></tr>
          </table>
        </div>
      </div>
    `;

    const emoji = level === 'high' ? '🔴' : '🔵';
    const telegramText = [
      `${emoji} <b>Alerta acuapónica</b>`,
      ``,
      `<b>Parámetro:</b> ${meta.label}`,
      `<b>Lectura:</b> ${value}${unit}`,
      `<b>Estado:</b> ${riskLabel} (${direction} del rango óptimo)`,
      `<b>Rango óptimo:</b> ${meta.optimal.min} – ${meta.optimal.max}${unit}`,
      `<b>Origen:</b> ${origin}`,
      `<b>Fecha:</b> ${timestamp}`,
    ].join('\n');

    await Promise.all([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);
  }
}
