import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Subscription } from 'rxjs';
import { MailService } from '../alerts/mail.service';
import { extractReadings } from '../alerts/thresholds';
import { MqttService } from '../mqtt/mqtt.service';

interface PlantHypothesis {
  id?: string;
  probability?: number;
  message?: string;
  evidence?: string[];
}

interface PlantAssessment {
  at?: string;
  status?: string;
  statusLabel?: string;
  hypotheses?: PlantHypothesis[];
  suggestedActions?: Array<{ action?: string; reason?: string }>;
}

export interface PlantTelemetry {
  count?: number;
  status?: string;
  healthMethod?: string;
  avgHealthScore?: number;
  findings?: Array<{
    id?: number;
    label?: string;
    confidence?: number;
    bbox?: number[];
  }>;
  assessment?: PlantAssessment;
}

@Injectable()
export class PlantAssessmentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PlantAssessmentService.name);
  private subscription: Subscription | null = null;
  private enabled = true;
  private mailThreshold = 50;
  private cooldownMs = 300_000;
  private lastMailAt = 0;
  private lastSensors: Record<string, number> = {};
  private lastPlants: PlantTelemetry | null = null;

  constructor(
    private readonly mqtt: MqttService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const decisionEnabled = this.config.get<boolean>('decision.enabled', true);
    this.enabled =
      decisionEnabled &&
      this.config.get<boolean>('decision.plantAssessment.enabled', true);
    this.mailThreshold = this.config.get<number>(
      'decision.plantAssessment.mailThreshold',
      50,
    );
    this.cooldownMs = this.config.get<number>(
      'decision.plantAssessment.cooldownMs',
      300_000,
    );

    if (!this.enabled) {
      this.logger.warn('Evaluación de plantas deshabilitada');
      return;
    }

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.onPayload(payload);
    });

    this.logger.log(
      `PlantAssessment activo (umbral ≥${this.mailThreshold}%, cooldown ${this.cooldownMs}ms)`,
    );
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  getLastPlants(): PlantTelemetry | null {
    return this.lastPlants;
  }

  async runNow(body?: { plants?: PlantTelemetry }): Promise<{
    ok: boolean;
    reason?: string;
  }> {
    const plants = body?.plants ?? this.lastPlants;
    if (!plants?.assessment) {
      return {
        ok: false,
        reason: 'No hay assessment de plantas disponible todavía',
      };
    }
    const sent = await this.sendMail(plants);
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
    const plantsRaw = (record.plants ?? record.plantas) as
      | PlantTelemetry
      | undefined;
    if (!plantsRaw || typeof plantsRaw !== 'object') return;
    // Ignore camera-only payloads without health fields
    if (
      plantsRaw.assessment == null &&
      plantsRaw.findings == null &&
      plantsRaw.count == null &&
      plantsRaw.avgHealthScore == null
    ) {
      if (plantsRaw.status != null || (plantsRaw as { cameraUrl?: string }).cameraUrl) {
        // may be camera merge; still store soft fields
        this.lastPlants = { ...this.lastPlants, ...plantsRaw };
      }
      return;
    }

    this.lastPlants = { ...this.lastPlants, ...plantsRaw };

    const assessment = plantsRaw.assessment;
    if (!assessment?.hypotheses?.length) return;

    const risky = assessment.hypotheses.filter(
      (h) => (h.probability ?? 0) >= this.mailThreshold,
    );
    if (risky.length === 0) return;
    if (Date.now() - this.lastMailAt < this.cooldownMs) return;

    void this.sendMail(this.lastPlants);
  }

  private async sendMail(plants: PlantTelemetry): Promise<boolean> {
    const assessment = plants.assessment;
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

    const sensorLines = [
      'ph',
      'electroconductividad',
      'humedad',
      'co2',
      'nitratos',
      'temperaturaAmbiente',
    ]
      .filter((k) => this.lastSensors[k] != null)
      .map((k) => `• ${k}: ${this.lastSensors[k]}`)
      .join('\n');

    const subject = `[AquaGia] Plantas · ${assessment.statusLabel ?? assessment.status ?? 'evaluación'}`;
    const text = [
      'Evaluación de salud de plantas',
      `Estado: ${assessment.statusLabel ?? assessment.status ?? 'n/d'}`,
      `Conteo: ${plants.count ?? 'n/d'} · score medio: ${plants.avgHealthScore ?? 'n/d'}`,
      `Método: ${plants.healthMethod ?? 'n/d'}`,
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
    ].join('\n');

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
      <h2>Evaluación de salud de plantas</h2>
      <p><b>Estado:</b> ${escapeHtml(String(assessment.statusLabel ?? assessment.status ?? 'n/d'))}</p>
      <p><b>Conteo:</b> ${plants.count ?? 'n/d'} · <b>Score:</b> ${plants.avgHealthScore ?? 'n/d'}</p>
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
      this.logger.log(`Correo de evaluación de plantas enviado (${subject})`);
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
