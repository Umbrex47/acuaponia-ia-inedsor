import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { MailService } from '../alerts/mail.service';
import { extractReadings } from '../alerts/thresholds';
import { MqttService } from '../mqtt/mqtt.service';

interface FishHypothesis {
  id?: string;
  probability?: number;
  message?: string;
  evidence?: string[];
}

interface FishAssessment {
  at?: string;
  status?: string;
  statusLabel?: string;
  hypotheses?: FishHypothesis[];
  suggestedActions?: Array<{ action?: string; reason?: string }>;
}

export interface FishTelemetry {
  count?: number;
  detections?: number;
  confidenceAvg?: number | null;
  mood?: string;
  behavior?: {
    activityState?: string;
    surfaceRatio?: number;
    activityScore?: number;
    nearSurface?: boolean;
    lowActivity?: boolean;
    windowSec?: number;
  };
  assessment?: FishAssessment;
}

/**
 * Consume telemetría de peces (MQTT) y envía correo cuando hay hipótesis de
 * riesgo por encima del umbral. No publica comandos a actuadores (fase futura).
 */
@Injectable()
export class FishAssessmentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FishAssessmentService.name);
  private subscription: Subscription | null = null;
  private enabled = true;
  private mailThreshold = 50;
  private cooldownMs = 300_000;
  private lastMailAt = 0;
  private lastSensors: Record<string, number> = {};
  private lastFish: FishTelemetry | null = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const decisionEnabled = this.config.get<boolean>('decision.enabled', true);
    this.enabled =
      decisionEnabled &&
      this.config.get<boolean>('decision.fishAssessment.enabled', true);
    this.mailThreshold = this.config.get<number>(
      'decision.fishAssessment.mailThreshold',
      50,
    );
    this.cooldownMs = this.config.get<number>(
      'decision.fishAssessment.cooldownMs',
      300_000,
    );

    if (!this.enabled) {
      this.logger.warn('Evaluación conductual de peces deshabilitada');
      return;
    }

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.onPayload(payload);
    });

    this.logger.log(
      `FishAssessment activo (umbral correo ≥${this.mailThreshold}%, cooldown ${this.cooldownMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getLastFish(): FishTelemetry | null {
    return this.lastFish;
  }

  /**
   * Fuerza un correo con el último assessment (o el cuerpo pasado).
   * POST /decision/fish-assessment/now
   */
  async runNow(body?: { fish?: FishTelemetry }): Promise<{
    ok: boolean;
    reason?: string;
  }> {
    const fish = body?.fish ?? this.lastFish;
    if (!fish?.assessment) {
      return {
        ok: false,
        reason: 'No hay assessment de peces disponible todavía',
      };
    }
    const sent = await this.sendMail(fish);
    return sent
      ? { ok: true }
      : {
          ok: false,
          reason: 'No se pudo enviar el correo (SMTP / destinatarios)',
        };
  }

  private onPayload(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!data || typeof data !== 'object') return;

    for (const reading of extractReadings(data)) {
      this.lastSensors[reading.key] = reading.value;
    }

    const record = data as Record<string, unknown>;
    const fishRaw = (record.fish ?? record.peces) as FishTelemetry | undefined;
    if (!fishRaw || typeof fishRaw !== 'object') return;

    this.lastFish = { ...this.lastFish, ...fishRaw };

    const assessment = fishRaw.assessment;
    if (!assessment?.hypotheses?.length) return;

    const risky = assessment.hypotheses.filter(
      (h) => (h.probability ?? 0) >= this.mailThreshold,
    );
    if (risky.length === 0) return;

    if (Date.now() - this.lastMailAt < this.cooldownMs) return;

    void this.sendMail(this.lastFish);
  }

  private async sendMail(fish: FishTelemetry): Promise<boolean> {
    const assessment = fish.assessment;
    if (!assessment) return false;

    const hypotheses = assessment.hypotheses ?? [];
    const lines = hypotheses.map(
      (h) =>
        `• ${h.message ?? h.id ?? 'hipótesis'} (${h.probability ?? '?'}%)` +
        (h.evidence?.length ? `\n  Evidencia: ${h.evidence.join(', ')}` : ''),
    );

    const actions = (assessment.suggestedActions ?? [])
      .map((a) => `• ${a.action}${a.reason ? ` (${a.reason})` : ''}`)
      .join('\n');

    const sensorLines = ['oxigeno', 'temperatura', 'ph', 'nivelAgua']
      .filter((k) => this.lastSensors[k] != null)
      .map((k) => `• ${k}: ${this.lastSensors[k]}`)
      .join('\n');

    const behavior = fish.behavior;
    const subject = `[AquaGia] Peces · ${assessment.statusLabel ?? assessment.status ?? 'evaluación'}`;
    const text = [
      'Evaluación conductual de peces',
      `Estado: ${assessment.statusLabel ?? assessment.status ?? 'n/d'}`,
      `Conteo: ${fish.count ?? 'n/d'} (detecciones ${fish.detections ?? 'n/d'})`,
      `Ánimo / actividad: ${fish.mood ?? 'n/d'} · ${behavior?.activityState ?? 'n/d'}`,
      behavior
        ? `surfaceRatio=${behavior.surfaceRatio} activityScore=${behavior.activityScore}`
        : '',
      '',
      'Hipótesis:',
      lines.join('\n') || '(ninguna)',
      '',
      'Acciones sugeridas (aún no ejecutadas):',
      actions || '(ninguna)',
      '',
      'Sensores recientes:',
      sensorLines || '(sin lecturas)',
      '',
      `UTC: ${assessment.at ?? new Date().toISOString()}`,
      '',
      'Solo información por correo; no se activaron actuadores.',
    ]
      .filter((line) => line !== '')
      .join('\n');

    const htmlHyp = hypotheses
      .map(
        (h) =>
          `<li><strong>${escapeHtml(h.message ?? String(h.id))}</strong>` +
          ` — ${h.probability ?? '?'}%` +
          (h.evidence?.length
            ? `<br/><small>${escapeHtml(h.evidence.join(', '))}</small>`
            : '') +
          `</li>`,
      )
      .join('');

    const html = `
      <h2>Evaluación conductual de peces</h2>
      <p><b>Estado:</b> ${escapeHtml(String(assessment.statusLabel ?? assessment.status ?? 'n/d'))}</p>
      <p><b>Conteo:</b> ${fish.count ?? 'n/d'} · <b>Actividad:</b> ${escapeHtml(String(behavior?.activityState ?? fish.mood ?? 'n/d'))}</p>
      <h3>Hipótesis</h3>
      <ul>${htmlHyp || '<li>(ninguna)</li>'}</ul>
      <h3>Acciones sugeridas</h3>
      <pre>${escapeHtml(actions || '(ninguna)')}</pre>
      <h3>Sensores</h3>
      <pre>${escapeHtml(sensorLines || '(sin lecturas)')}</pre>
      <p><small>Solo información por correo; no se activaron actuadores.</small></p>
    `;

    const ok = await this.mail.send({ subject, text, html });
    if (ok) {
      this.lastMailAt = Date.now();
      this.logger.log(`Correo de evaluación de peces enviado (${subject})`);
    }
    return ok;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
