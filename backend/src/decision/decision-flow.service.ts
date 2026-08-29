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
import { Subscription } from 'rxjs';
import { ActuatorService } from '../actuators/actuator.service';
import { AssistantService } from '../assistants/assistant.service';
import { GeminiService } from '../assistants/gemini.service';
import { MailService } from '../alerts/mail.service';
import { TelegramService } from '../alerts/telegram.service';
import { evaluateRisk, extractReadings, SENSOR_THRESHOLDS } from '../alerts/thresholds';
import { DemoTelemetryService } from '../aquaponic/demo-telemetry.service';
import { MqttService } from '../mqtt/mqtt.service';
import { NotificationService } from '../notifications/notification.service';
import {
  IaActionLog,
  IaActionLogDocument,
  IaActionStep,
} from './schemas/ia-action-log.schema';

interface Escalation {
  id: string;
  sensorKey: string;
  label: string;
  unit: string;
  value: number;
  level: 'low' | 'high';
  optimal: { min: number; max: number };
  firstSeenAt: number;
  timer: NodeJS.Timeout;
}

interface RuleDecision {
  actuatorId: string;
  action: 'on' | 'off';
  reason: string;
}

const CLIENT_ID = 'decision-flow';

@Injectable()
export class DecisionFlowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DecisionFlowService.name);

  private subscription: Subscription | null = null;
  private enabled = true;
  private escalationMs = 60_000;
  private useGemini = true;
  private rulesFallback = true;
  private reportEmail = true;
  private reportCooldownMs = 300_000;
  private maxParallel = 3;

  private readonly escalations = new Map<string, Escalation>();
  /** Bitácora en memoria (espejo de Mongo si está disponible). */
  private readonly logs: Escalation[] = [];
  private lastReportAt = 0;

  constructor(
    private readonly mqtt: MqttService,
    private readonly demo: DemoTelemetryService,
    private readonly actuators: ActuatorService,
    private readonly notifications: NotificationService,
    private readonly mail: MailService,
    private readonly telegram: TelegramService,
    private readonly config: ConfigService,
    @Optional()
    @Inject(forwardRef(() => AssistantService))
    private readonly assistant?: AssistantService,
    @Optional()
    private readonly gemini?: GeminiService,
    @Optional()
    @InjectModel(IaActionLog.name)
    private readonly logModel?: Model<IaActionLogDocument>,
  ) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('decision.flow.enabled', true);
    this.escalationMs = this.config.get<number>('decision.flow.escalationMs', 60_000);
    this.useGemini = this.config.get<boolean>('decision.flow.useGemini', true);
    this.rulesFallback = this.config.get<boolean>('decision.flow.rulesFallback', true);
    this.reportEmail = this.config.get<boolean>('decision.flow.reportEmail', true);
    this.reportCooldownMs = this.config.get<number>('decision.flow.reportCooldownMs', 300_000);
    this.maxParallel = this.config.get<number>('decision.flow.maxParallel', 3);

    if (!this.enabled) {
      this.logger.warn('DecisionFlow deshabilitado (DECISION_FLOW_ENABLED=false)');
      return;
    }

    this.demo.setOnRecoveryHook((sensorKey) => {
      void this.onRecovery(sensorKey);
    });

    this.subscription = this.mqtt.messages$.subscribe(({ payload }) => {
      this.processPayload(payload);
    });

    this.logger.log(
      `Flujo Alerta→IA→Normalización activo (escalación ${this.escalationMs}ms, parallel≤${this.maxParallel}, Gemini=${this.useGemini})`,
    );

    void this.loadLogsFromMongo();
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
    for (const esc of this.escalations.values()) {
      clearTimeout(esc.timer);
    }
    this.escalations.clear();
  }

  getStatus() {
    return {
      enabled: this.enabled,
      escalationMs: this.escalationMs,
      maxParallel: this.maxParallel,
      pending: Array.from(this.escalations.values()).map((e) => ({
        sensor: e.sensorKey,
        value: e.value,
        level: e.level,
        firstSeenAt: new Date(e.firstSeenAt).toISOString(),
        remainingMs: Math.max(0, this.escalationMs - (Date.now() - e.firstSeenAt)),
      })),
      stats: {
        total: this.logs.length,
        last24h: this.logs.filter(
          (l) => Date.now() - l.firstSeenAt <= 24 * 3_600_000,
        ).length,
      },
    };
  }

  listLogs(limit = 20): Array<Record<string, unknown>> {
    return this.logs
      .slice()
      .sort((a, b) => b.firstSeenAt - a.firstSeenAt)
      .slice(0, limit)
      .map((e) => this.serializeLog(e));
  }

  clearLogs(): void {
    this.logs.length = 0;
    if (this.logModel) {
      void this.logModel.deleteMany({}).catch((err) =>
        this.logger.warn(`No se pudo limpiar Mongo: ${(err as Error).message}`),
      );
    }
  }

  cancelPending(sensorKey?: string): string[] {
    const cancelled: string[] = [];
    for (const [key, esc] of this.escalations.entries()) {
      if (!sensorKey || key === sensorKey) {
        clearTimeout(esc.timer);
        this.escalations.delete(key);
        cancelled.push(key);
      }
    }
    if (cancelled.length > 0) {
      this.logger.log(`Escalaciones canceladas: ${cancelled.join(', ')}`);
    }
    return cancelled;
  }

  /**
   * Punto de entrada para forzar el ciclo sobre un payload arbitrario
   * (uso de debugging / demo). Devuelve el log creado.
   */
  async forceCycle(
    sensorKey: string,
    value: number,
  ): Promise<Record<string, unknown> | null> {
    const meta = SENSOR_THRESHOLDS[sensorKey];
    if (!meta) return null;
    const level = evaluateRisk(sensorKey, value);
    if (!level || level === 'stable') return null;
    const escalation = this.createEscalation(sensorKey, meta, value, level);
    await this.runEscalation(escalation);
    return this.serializeLog(escalation);
  }

  private async loadLogsFromMongo(): Promise<void> {
    if (!this.logModel) return;
    try {
      const docs = await this.logModel
        .find()
        .sort({ firstSeenAt: -1 })
        .limit(50)
        .lean();
      this.logs.length = 0;
      for (const doc of docs) {
        this.logs.push({
          id: String(doc._id ?? ''),
          sensorKey: doc.sensorKey,
          label: doc.label,
          unit: doc.unit,
          value: doc.value,
          level: doc.level,
          optimal: doc.optimal,
          firstSeenAt: doc.firstSeenAt?.getTime?.() ?? Date.now(),
          timer: null as unknown as NodeJS.Timeout,
        });
      }
    } catch (err) {
      this.logger.warn(`No se pudieron cargar logs: ${(err as Error).message}`);
    }
  }

  private processPayload(raw: string): void {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    const readings = extractReadings(data);
    if (readings.length === 0) return;

    for (const { key, value } of readings) {
      const meta = SENSOR_THRESHOLDS[key];
      if (!meta) continue;
      const level = evaluateRisk(key, value);
      const existing = this.escalations.get(key);

      if (level && level !== 'stable') {
        if (existing) {
          // Actualiza el valor actual; si el nivel cambia, reemplazamos el log.
          existing.value = value;
          if (existing.level !== level) existing.level = level;
        } else if (this.demo.isNormalizing(key)) {
          // Si ya estamos en modo normalización, no re-escalamos.
          continue;
        } else if (this.escalations.size < this.maxParallel) {
          this.createEscalation(key, meta, value, level);
        } else {
          this.logger.debug(
            `Máximo de escalaciones simultáneas alcanzado (${this.maxParallel}); omitiendo ${key}`,
          );
        }
      } else if (existing) {
        // El sensor volvió a rango antes de que la IA decidiera: cancelamos.
        clearTimeout(existing.timer);
        this.escalations.delete(key);
        this.logger.log(`Sensor ${key} volvió a rango antes de la decisión IA`);
      }
    }
  }

  private createEscalation(
    sensorKey: string,
    meta: { label: string; unit: string; optimal: { min: number; max: number } },
    value: number,
    level: 'low' | 'high',
  ): Escalation {
    const now = Date.now();
    const esc: Escalation = {
      id: `${sensorKey}-${now}`,
      sensorKey,
      label: meta.label,
      unit: meta.unit,
      value,
      level,
      optimal: meta.optimal,
      firstSeenAt: now,
      timer: null as unknown as NodeJS.Timeout,
    };

    this.logger.warn(
      `⚠️ ${meta.label} ${level === 'high' ? 'alto' : 'bajo'} (${value}${meta.unit ? ' ' + meta.unit : ''}) — alerta temprana, esperando ${this.escalationMs}ms`,
    );

    this.escalations.set(sensorKey, esc);
    this.logs.push(esc);

    void this.notifications.emit({
      category: 'early-warning-active',
      severity: 'warn',
      title: `Alerta temprana: ${meta.label} fuera de rango`,
      message: `Esperando ${Math.round(this.escalationMs / 1000)}s antes de pedir acción a la IA (valor ${value}${meta.unit ? ' ' + meta.unit : ''})`,
      dedupeKey: `flow:early:${sensorKey}`,
      source: 'auto',
      meta: { sensor: sensorKey, value, level, escalationMs: this.escalationMs },
    });

    esc.timer = setTimeout(() => {
      void this.runEscalation(esc);
    }, this.escalationMs);

    return esc;
  }

  private async runEscalation(esc: Escalation): Promise<void> {
    this.escalations.delete(esc.sensorKey);
    const step: IaActionStep = {
      ts: new Date().toISOString(),
      phase: 'actor-decision',
    };

    let decisionSource: 'gemini' | 'rules' | 'none' = 'none';
    const actions: Array<{ actuatorId: string; action: string; reason: string; ok: boolean }> = [];

    try {
      let decisions: RuleDecision[] = [];
      if (this.useGemini && this.assistant && (await this.geminiReady())) {
        decisionSource = 'gemini';
        decisions = await this.decideByGemini(esc);
      }

      if (decisions.length === 0 && this.rulesFallback) {
        decisionSource = decisions.length === 0 ? 'rules' : decisionSource;
        decisions = this.decideByRules(esc);
      }

      if (decisions.length === 0) {
        step.detail = 'La IA no propuso acciones ejecutables';
        this.logger.warn(`${esc.label}: sin acciones para aplicar`);
      } else {
        for (const d of decisions) {
          const result = await this.actuators.execute(d.actuatorId, d.action, {
            reason: `[IA decision-flow] ${d.reason}`,
            actor: 'ia',
          });
          actions.push({
            actuatorId: d.actuatorId,
            action: d.action,
            reason: d.reason,
            ok: result.ok,
          });
          step.detail = result.ok
            ? `${d.actuatorId} → ${d.action.toUpperCase()}`
            : `No se pudo ${d.action} ${d.actuatorId}: ${result.reason}`;
        }
      }
    } catch (err) {
      step.detail = `Error: ${(err as Error).message}`;
      this.logger.error(`Error en decisión IA: ${step.detail}`);
    }

    await this.persistLog(esc, decisionSource, actions);

    const summary = actions.length
      ? actions.map((a) => `${a.actuatorId} → ${a.action}${a.ok ? '' : ' (falló)'}`).join(', ')
      : 'Sin acciones aplicadas';

    void this.notifications.emit({
      category: 'ia-decision',
      severity: actions.every((a) => a.ok) ? 'info' : 'warn',
      title: `IA · Decisión sobre ${esc.label}`,
      message: `Origen: ${decisionSource}. Acciones: ${summary}.`,
      dedupeKey: `flow:decision:${esc.sensorKey}`,
      source: 'ia',
      meta: {
        sensor: esc.sensorKey,
        source: decisionSource,
        actions,
      },
    });

    // Disparar normalización del simulador (visualización y rampa).
    const recovery = this.demo.triggerIaRecovery([esc.sensorKey]);
    this.logger.log(
      `DecisionFlow[${esc.sensorKey}] → ${decisionSource}, normalización=${recovery.normalizing.join(',') || 'ninguna'}`,
    );
  }

  private async decideByGemini(esc: Escalation): Promise<RuleDecision[]> {
    if (!this.assistant) return [];
    const prompt = [
      `El sensor "${esc.label}" (${esc.sensorKey}) está en nivel ${esc.level} con valor ${esc.value}${esc.unit ? ' ' + esc.unit : ''}.`,
      `Rango óptimo: ${esc.optimal.min} – ${esc.optimal.max}${esc.unit ? ' ' + esc.unit : ''}.`,
      'Usa las herramientas disponibles para consultar el estado actual y proponer o ejecutar acciones. No publiques comandos manualmente.',
      'Si activas algún actuador, explica brevemente la evidencia. Si no hay nada razonable que hacer, responde "sin acciones".',
    ].join(' ');
    try {
      const result = await this.assistant.chat(CLIENT_ID, prompt);
      return this.collectDecisions(result.toolCalls);
    } catch (err) {
      this.logger.warn(`Gemini no disponible: ${(err as Error).message}`);
      return [];
    }
  }

  private collectDecisions(
    toolCalls: Array<{ name: string; ok: boolean; summary: string }> = [],
  ): RuleDecision[] {
    const decisions: RuleDecision[] = [];
    for (const tc of toolCalls) {
      if (!tc.ok) continue;
      const sum = tc.summary.toLowerCase();
      if (tc.name === 'turn_actuator_on' || tc.name === 'execute_actuator_command') {
        const match = sum.match(/(bomba_agua|aireador|dispensador_comida)/);
        if (match) {
          decisions.push({
            actuatorId: match[1],
            action: 'on',
            reason: tc.summary,
          });
        }
      } else if (tc.name === 'turn_actuator_off') {
        const match = sum.match(/(bomba_agua|aireador|dispensador_comida)/);
        if (match) {
          decisions.push({
            actuatorId: match[1],
            action: 'off',
            reason: tc.summary,
          });
        }
      }
    }
    return decisions;
  }

  /**
   * Fallback determinístico: misma lógica que EmergencyPolicyService pero
   * invocada con `actor: 'ia'` (no emergency) y solo si la condición es
   * suficientemente clara.
   */
  private decideByRules(esc: Escalation): RuleDecision[] {
    const { sensorKey, level, value, label } = esc;
    const decisions: RuleDecision[] = [];

    if (sensorKey === 'oxigeno' && level === 'low') {
      decisions.push({
        actuatorId: 'aireador',
        action: 'on',
        reason: `${label} bajo (${value}) — encender aireador para oxigenar`,
      });
    } else if (sensorKey === 'ph' && level === 'low') {
      decisions.push({
        actuatorId: 'aireador',
        action: 'on',
        reason: `pH bajo (${value}) — aireador para mejorar disponibilidad de O₂`,
      });
    } else if (sensorKey === 'nivelAgua' && level === 'low') {
      decisions.push({
        actuatorId: 'bomba_agua',
        action: 'off',
        reason: `Nivel bajo (${value}) — bomba apagada para evitar marcha en seco`,
      });
    } else if (sensorKey === 'temperatura' && level === 'high') {
      decisions.push({
        actuatorId: 'aireador',
        action: 'on',
        reason: `Temperatura alta (${value}) — aireador para enfriar`,
      });
    } else if (sensorKey === 'turbiedad' && level === 'high') {
      // No hay actuador directo; registramos la acción para la bitácora.
      decisions.push({
        actuatorId: 'manual_note',
        action: 'on',
        reason: `Turbidez alta (${value}) — se sugiere limpieza del filtro mecánico`,
      });
    }

    return decisions;
  }

  private async persistLog(
    esc: Escalation,
    decisionSource: 'gemini' | 'rules' | 'none',
    actions: Array<{ actuatorId: string; action: string; reason: string; ok: boolean }>,
  ): Promise<void> {
    if (!this.logModel) return;
    try {
      const steps: IaActionStep[] = [
        {
          ts: new Date(esc.firstSeenAt).toISOString(),
          phase: 'early-warning',
          detail: `${esc.label} ${esc.level === 'high' ? 'alto' : 'bajo'} (${esc.value}${esc.unit ? ' ' + esc.unit : ''})`,
        },
        {
          ts: new Date().toISOString(),
          phase: 'actor-decision',
          detail: `Origen: ${decisionSource}. ${actions.length} acción(es).`,
        },
      ];
      const summary = actions.length === 0
        ? 'La IA no aplicó acciones'
        : actions.map((a) => `${a.actuatorId} → ${a.action}${a.ok ? '' : ' (falló)'}`).join('; ');
      await this.logModel.create({
        sensorKey: esc.sensorKey,
        label: esc.label,
        unit: esc.unit,
        value: esc.value,
        level: esc.level,
        optimal: esc.optimal,
        status: 'acting',
        firstSeenAt: new Date(esc.firstSeenAt),
        escalatedAt: new Date(),
        decidedAt: new Date(),
        decisionSource,
        steps,
        summary,
      });
    } catch (err) {
      this.logger.warn(`No se pudo persistir log: ${(err as Error).message}`);
    }
  }

  private async geminiReady(): Promise<boolean> {
    if (!this.gemini) return false;
    try {
      return await this.gemini.isAvailable();
    } catch {
      return false;
    }
  }

  private serializeLog(esc: Escalation): Record<string, unknown> {
    return {
      id: esc.id,
      sensor: esc.sensorKey,
      label: esc.label,
      unit: esc.unit,
      value: esc.value,
      level: esc.level,
      optimal: esc.optimal,
      firstSeenAt: new Date(esc.firstSeenAt).toISOString(),
    };
  }

  /**
   * Llamado por el demo (o por WebSocket) cuando un sensor vuelve a rango
   * tras la normalización. Publica el reporte final.
   */
  async onRecovery(sensorKey: string): Promise<void> {
    const now = Date.now();
    const matching = this.logs.filter((l) => l.sensorKey === sensorKey);
    if (matching.length === 0) return;

    const last = matching[matching.length - 1];
    const recoveryMs = now - last.firstSeenAt;

    void this.notifications.emit({
      category: 'ia-recovery',
      severity: 'success',
      title: `IA · ${last.label} recuperado`,
      message: `El sensor volvió a su rango óptimo tras ${Math.round(recoveryMs / 1000)}s.`,
      dedupeKey: `flow:recovery:${sensorKey}`,
      source: 'ia',
      meta: { sensor: sensorKey, recoveryMs },
    });

    this.logger.log(`Recuperación IA para ${sensorKey} en ${recoveryMs}ms`);

    if (this.reportEmail && now - this.lastReportAt >= this.reportCooldownMs) {
      this.lastReportAt = now;
      void this.sendReportEmail();
    }
  }

  private async sendReportEmail(): Promise<void> {
    const recent = this.logs
      .filter((l) => Date.now() - l.firstSeenAt <= 24 * 3_600_000)
      .slice(-10);
    if (recent.length === 0) return;

    const lines = recent.map(
      (l) =>
        `• ${l.label} (${l.sensorKey}) → ${l.value}${l.unit ? ' ' + l.unit : ''} ${l.level === 'high' ? 'alto' : 'bajo'} a las ${new Date(l.firstSeenAt).toLocaleTimeString('es-MX')}`,
    );

    const subject = '[Aquaponía] IA · Reporte de intervenciones';
    const text = [
      'Intervenciones IA del flujo Alerta → IA → Normalización',
      '',
      ...lines,
      '',
      `Generado: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`,
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden">
        <div style="background:#0a0a0a;color:#fff;padding:14px 20px"><h2 style="margin:0;font-size:16px">IA · Reporte de intervenciones</h2></div>
        <div style="padding:18px;color:#0a0a0a;font-size:14px">
          <ul>${recent.map((l) => `<li><strong>${l.label}</strong>: ${l.value}${l.unit ? ' ' + l.unit : ''} (${l.level})</li>`).join('')}</ul>
        </div>
      </div>`;

    const telegramText = [
      '📑 <b>IA · Reporte de intervenciones</b>',
      '',
      ...recent.map((l) => `• ${l.label}: ${l.value}${l.unit ? ' ' + l.unit : ''} (${l.level})`),
    ].join('\n');

    await Promise.allSettled([
      this.mail.send({ subject, text, html }),
      this.telegram.send({ text: telegramText }),
    ]);

    void this.notifications.emit({
      category: 'ia-report',
      severity: 'info',
      title: 'IA · Reporte enviado',
      message: `Reporte de intervenciones (${recent.length}) enviado por mail/Telegram.`,
      dedupeKey: 'flow:report',
      source: 'system',
      meta: { count: recent.length },
    });
  }
}
