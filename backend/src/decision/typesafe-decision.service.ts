import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActuatorService } from '../actuators/actuator.service';
import { NotificationService } from '../notifications/notification.service';
import { MqttService } from '../mqtt/mqtt.service';
import { TelegramService } from '../alerts/telegram.service';
import { MailService } from '../alerts/mail.service';
import { AlertService } from '../alerts/alert.service';
import { TypeSafeClient, choice, score } from '@typesafe-ai/sdk';
import { getHumanActions, HumanActionProtocol } from '../alerts/human-actions';

export interface TypeSafeEvaluationParams {
  ph: number;
  temperaturaAgua: number;
  oxigenoDisuelto: number;
  nivelAgua: number;
  electroconductividad: number;
  turbidez: number;
  amonio?: number;
  nitratos?: number;
  plantStatus?: 'healthy' | 'stressed' | 'diseased' | 'nutrient_deficient';
  plantAvgHealth?: number;
  fishStatus?: 'calm' | 'active' | 'stressed' | 'surface_crowding';
  fishCount?: number;
}

export interface TypeSafeEvaluationOptions {
  executeIot?: boolean;
  apiKey?: string;
  notes?: string;
}

export interface IotActionDecision {
  actuatorId: string;
  actuatorLabel: string;
  proposedAction: 'on' | 'off';
  currentStatus?: boolean;
  executed: boolean;
  executionResult?: { ok: boolean; reason?: string };
  reason: string;
  biologicalEvidence: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface TypeSafeQuestionOutput {
  category: string;
  parameterKey: string;
  title: string;
  type: 'choice' | 'score' | 'noul';
  selected: string | number;
  label?: string;
  confidence: number;
  probabilities: Record<string, number> | number[];
  explanation: string;
}

export interface TypeSafeEvaluationResult {
  id: string;
  timestamp: string;
  status: 'optimal' | 'warning' | 'critical';
  statusLabel: string;
  systemStabilityScore: number; // 0 - 100
  stabilityLevel: string;
  params: TypeSafeEvaluationParams;
  options: TypeSafeEvaluationOptions;
  questions: Record<string, TypeSafeQuestionOutput>;
  iotDecisions: IotActionDecision[];
  explanations: {
    summary: string;
    waterChemistryAnalysis: string;
    iotDecisionRationale: string;
    plantEcosystemStatus: string;
    fishWelfareStatus: string;
    holisticIntegrationAnalysis: string;
    humanActions?: HumanActionProtocol[];
  };
  meta: {
    engine: 'typesafe.ai' | 'typesafe.ai-simulator';
    model: string;
    totalQuestions: number;
    durationMs: number;
  };
}

export interface ScenarioPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  severity: 'optimal' | 'warning' | 'critical';
  params: TypeSafeEvaluationParams;
}

@Injectable()
export class TypeSafeDecisionService {
  private readonly logger = new Logger(TypeSafeDecisionService.name);
  private readonly history: TypeSafeEvaluationResult[] = [];
  private readonly MAX_HISTORY = 50;

  constructor(
    private readonly config: ConfigService,
    private readonly actuators: ActuatorService,
    private readonly notifications: NotificationService,
    private readonly mqtt: MqttService,
    @Optional() private readonly telegram?: TelegramService,
    @Optional() private readonly mail?: MailService,
    @Optional() private readonly alerts?: AlertService,
  ) {}

  /**
   * Catálogo de presets para probar diferentes estados del ecosistema acuapónico.
   * Incluye casos específicos para pH bajo (ácido), pH alto (alcalino), hipoxia, marcha en seco, etc.
   */
  getPresets(): ScenarioPreset[] {
    return [
      {
        id: 'optimo',
        name: 'Condición Óptima y Equilibrada',
        description: 'Todos los parámetros fisicoquímicos en rango ideal para tilapia y hortalizas.',
        badge: 'Óptimo',
        severity: 'optimal',
        params: {
          ph: 6.9,
          temperaturaAgua: 23.8,
          oxigenoDisuelto: 6.8,
          nivelAgua: 88,
          electroconductividad: 1.45,
          turbidez: 8.5,
          amonio: 0.15,
          nitratos: 45,
          plantStatus: 'healthy',
          plantAvgHealth: 0.94,
          fishStatus: 'active',
          fishCount: 18,
        },
      },
      {
        id: 'acidosis_critica',
        name: 'Acidosis Grave (pH Ácido < 5.4)',
        description: 'Caída brusca de pH por nitrificación sin carbonatos. Inhibe biofiltro y bloquea fósforo/calcio.',
        badge: 'Acidosis Crítica',
        severity: 'critical',
        params: {
          ph: 5.1,
          temperaturaAgua: 22.5,
          oxigenoDisuelto: 5.9,
          nivelAgua: 82,
          electroconductividad: 1.6,
          turbidez: 14.0,
          amonio: 0.1,
          nitratos: 60,
          plantStatus: 'stressed',
          plantAvgHealth: 0.52,
          fishStatus: 'stressed',
          fishCount: 17,
        },
      },
      {
        id: 'alcalosis_toxica',
        name: 'Alcalosis Extrema (pH Alcalino > 8.4)',
        description: 'pH alto provoca precipitación de micronutrientes (hierro) y pico letal de amoníaco libre (NH3).',
        badge: 'Alcalosis Tóxica',
        severity: 'critical',
        params: {
          ph: 8.6,
          temperaturaAgua: 26.2,
          oxigenoDisuelto: 6.2,
          nivelAgua: 85,
          electroconductividad: 1.35,
          turbidez: 11.0,
          amonio: 0.75,
          nitratos: 32,
          plantStatus: 'nutrient_deficient',
          plantAvgHealth: 0.44,
          fishStatus: 'stressed',
          fishCount: 18,
        },
      },
      {
        id: 'hipoxia_severa',
        name: 'Hipoxia Crítica (Asfixia Inminente)',
        description: 'Oxígeno disuelto < 3.0 mg/L. Los peces boquean en superficie; riesgo letal en minutos.',
        badge: 'Hipoxia Crítica',
        severity: 'critical',
        params: {
          ph: 6.8,
          temperaturaAgua: 27.2,
          oxigenoDisuelto: 2.6,
          nivelAgua: 78,
          electroconductividad: 1.4,
          turbidez: 24.0,
          amonio: 0.45,
          nitratos: 50,
          plantStatus: 'stressed',
          plantAvgHealth: 0.65,
          fishStatus: 'surface_crowding',
          fishCount: 18,
        },
      },
      {
        id: 'marcha_en_seco',
        name: 'Nivel Crítico de Agua (Marcha en Seco)',
        description: 'Nivel del reservorio < 22%. Riesgo inminente de cavitación y quema de la bomba sumergible.',
        badge: 'Nivel Crítico',
        severity: 'critical',
        params: {
          ph: 7.0,
          temperaturaAgua: 23.0,
          oxigenoDisuelto: 6.2,
          nivelAgua: 17,
          electroconductividad: 1.2,
          turbidez: 12.0,
          amonio: 0.2,
          nitratos: 35,
          plantStatus: 'healthy',
          plantAvgHealth: 0.82,
          fishStatus: 'active',
          fishCount: 16,
        },
      },
      {
        id: 'estres_termico',
        name: 'Estrés Térmico (Hipertermia > 31°C)',
        description: 'Alta temperatura desgasifica el agua, acelera el metabolismo y multiplica el riesgo de patógenos.',
        badge: 'Estrés Térmico',
        severity: 'warning',
        params: {
          ph: 7.1,
          temperaturaAgua: 32.2,
          oxigenoDisuelto: 4.4,
          nivelAgua: 70,
          electroconductividad: 1.9,
          turbidez: 19.0,
          amonio: 0.4,
          nitratos: 55,
          plantStatus: 'stressed',
          plantAvgHealth: 0.6,
          fishStatus: 'stressed',
          fishCount: 18,
        },
      },
      {
        id: 'deficiencia_ec',
        name: 'Agotamiento Nutricional (Baja EC < 0.6)',
        description: 'Solución excesivamente diluida. Inanición nutricional en raíces y clorosis generalizada.',
        badge: 'Baja EC',
        severity: 'warning',
        params: {
          ph: 6.7,
          temperaturaAgua: 23.0,
          oxigenoDisuelto: 6.5,
          nivelAgua: 90,
          electroconductividad: 0.45,
          turbidez: 5.0,
          amonio: 0.05,
          nitratos: 10,
          plantStatus: 'nutrient_deficient',
          plantAvgHealth: 0.48,
          fishStatus: 'calm',
          fishCount: 15,
        },
      },
      {
        id: 'turbidez_critica',
        name: 'Sobrecarga de Sólidos (Turbidez > 30 NTU)',
        description: 'Exceso de detritos coloidales. Filtro mecánico colmatado y daño mecánico en branquias.',
        badge: 'Alta Turbidez',
        severity: 'warning',
        params: {
          ph: 6.85,
          temperaturaAgua: 24.5,
          oxigenoDisuelto: 5.0,
          nivelAgua: 76,
          electroconductividad: 1.65,
          turbidez: 34.0,
          amonio: 0.5,
          nitratos: 65,
          plantStatus: 'stressed',
          plantAvgHealth: 0.62,
          fishStatus: 'stressed',
          fishCount: 18,
        },
      },
    ];
  }

  getHistory(limit = 20): TypeSafeEvaluationResult[] {
    return this.history.slice(0, limit);
  }

  getStatus() {
    const configuredKey =
      Boolean(this.config.get<string>('TYPESAFE_API_KEY')) ||
      Boolean(process.env.TYPESAFE_API_KEY);
    return {
      sdkInstalled: true,
      sdkVersion: '0.1.0',
      apiKeyConfigured: configuredKey,
      totalEvaluations: this.history.length,
      availablePresets: this.getPresets().length,
      questionsPerEvaluation: 29,
    };
  }

  /**
   * Ejecuta la evaluación estricta con el modelo TypeSafe AI SystemOne.
   * Contiene 3 preguntas por cada uno de los 8 parámetros del sistema (24)
   * más 5 preguntas integradoras del ecosistema global.
   */
  async evaluate(
    params: TypeSafeEvaluationParams,
    options: TypeSafeEvaluationOptions = {},
  ): Promise<TypeSafeEvaluationResult> {
    const startTime = Date.now();
    const apiKey =
      options.apiKey ||
      this.config.get<string>('TYPESAFE_API_KEY') ||
      process.env.TYPESAFE_API_KEY;

    // Estado formal tipado para TypeSafe SystemOne
    const state = {
      timestamp: new Date().toISOString(),
      water_quality: {
        ph: Number(params.ph.toFixed(2)),
        dissolved_oxygen_mg_l: Number(params.oxigenoDisuelto.toFixed(2)),
        water_temperature_c: Number(params.temperaturaAgua.toFixed(1)),
        water_level_pct: Number(params.nivelAgua.toFixed(1)),
        water_level_cm: Number(((params.nivelAgua / 100) * 32).toFixed(1)),
        electrical_conductivity_ms_cm: Number(params.electroconductividad.toFixed(2)),
        turbidity_ntu: Number(params.turbidez.toFixed(1)),
        ammonia_mg_l: params.amonio ?? (params.ph > 8.0 ? 0.45 : 0.02),
        nitrate_mg_l: params.nitratos ?? 25,
      },
      biology: {
        plants_health_class: params.plantStatus ?? 'healthy',
        plants_health_score: Number((params.plantAvgHealth ?? 0.85).toFixed(2)),
        fish_state: params.fishStatus ?? 'active',
        fish_count: params.fishCount ?? 16,
      },
      actuators_connected: {
        bomba_agua: true,
        aireador: true,
        dispensador_comida: true,
      },
    };

    // Formulación de las 29 preguntas con reglas estrictas mediante el SDK de TypeSafe AI
    const questionsSchema = this.buildQuestionsSchema();

    let evaluatedAnswers: Record<string, any>;
    let engineUsed: 'typesafe.ai' | 'typesafe.ai-simulator' = 'typesafe.ai-simulator';
    let modelName = 'typesafe-system-one';

    // Si hay API key disponible, invocamos el SDK oficial de TypeSafe AI
    if (apiKey) {
      try {
        const client = new TypeSafeClient({ apiKey });
        const response = await client.systemOne({
          state,
          questions: questionsSchema,
        });
        evaluatedAnswers = response.answers;
        engineUsed = 'typesafe.ai';
        modelName = response.model || 'typesafe-v1';
        this.logger.log(`Evaluación exitosa con TypeSafe AI (${modelName})`);
      } catch (err) {
        this.logger.warn(
          `Error invocando TypeSafe API (${(err as Error).message}). Ejecutando motor de inferencia acuapónica determinista...`,
        );
        evaluatedAnswers = this.runLocalDeterministicInference(params);
      }
    } else {
      evaluatedAnswers = this.runLocalDeterministicInference(params);
    }

    // Procesamiento y tipado estructurado de las 29 respuestas organizadas por parámetro
    const processedQuestions = this.formatQuestionsOutput(evaluatedAnswers, questionsSchema);

    // Mapeo riguroso de respuestas hacia actuadores IoT
    const iotDecisions = await this.deriveIotDecisions(
      params,
      evaluatedAnswers,
      options.executeIot ?? false,
    );

    // Estabilidad global del ecosistema
    const stabilityScore = this.calculateStabilityScore(evaluatedAnswers, params);
    const balanceChoice = evaluatedAnswers.sistema_balance_ecosistema_global?.choice;

    let overallStatus: 'optimal' | 'warning' | 'critical' = 'optimal';
    if (
      stabilityScore < 45 ||
      balanceChoice === 'colapso_inminente_multivariable' ||
      iotDecisions.some((d) => d.urgency === 'critical')
    ) {
      overallStatus = 'critical';
    } else if (
      stabilityScore < 75 ||
      balanceChoice === 'descompensacion_sistemica'
    ) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'optimal';
    }

    const statusLabel =
      overallStatus === 'critical'
        ? 'Riesgo Crítico / Intervención Requerida'
        : overallStatus === 'warning'
        ? 'Precaución / Desbalance Detectado'
        : 'Condiciones Óptimas y Estables';

    // Generar explicaciones científicas integradas
    const explanations = this.generateExplanations(
      params,
      evaluatedAnswers,
      iotDecisions,
      overallStatus,
      stabilityScore,
    );

    const result: TypeSafeEvaluationResult = {
      id: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      status: overallStatus,
      statusLabel,
      systemStabilityScore: stabilityScore,
      stabilityLevel:
        stabilityScore >= 80
          ? 'Excelente'
          : stabilityScore >= 60
          ? 'Aceptable'
          : stabilityScore >= 40
          ? 'Degradado'
          : 'Crítico',
      params,
      options,
      questions: processedQuestions,
      iotDecisions,
      explanations,
      meta: {
        engine: engineUsed,
        model: modelName,
        totalQuestions: Object.keys(processedQuestions).length,
        durationMs: Date.now() - startTime,
      },
    };

    // Guardar en historial
    this.history.unshift(result);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.pop();
    }

    // Emitir notificación si hubo riesgo crítico, desbalance o ejecución de actuadores
    if (overallStatus !== 'optimal' || options.executeIot) {
      void this.notifications.emit({
        category: 'ia-decision',
        severity: overallStatus === 'critical' ? 'critical' : 'warn',
        title: `TypeSafe AI · ${statusLabel}`,
        message: explanations.summary,
        dedupeKey: `typesafe:eval:${result.id}`,
        source: 'ia',
        meta: {
          score: stabilityScore,
          totalQuestions: 29,
          decisions: iotDecisions.map((d) => `${d.actuatorId}→${d.proposedAction}`),
        },
      });

      // Si se detecta un desbalance en el sistema (Status no óptimo), emitir alerta inmediata
      if (overallStatus !== 'optimal') {
        const icon = overallStatus === 'critical' ? '🚨' : '⚠️';

        const humanActions: HumanActionProtocol[] = [];
        if (params.ph < 6.4) {
          const act = getHumanActions('ph', 'low');
          if (act) humanActions.push(act);
        } else if (params.ph > 7.6) {
          const act = getHumanActions('ph', 'high');
          if (act) humanActions.push(act);
        }
        if (params.oxigenoDisuelto < 5.0) {
          const act = getHumanActions('oxigeno', 'low');
          if (act) humanActions.push(act);
        }
        if (params.temperaturaAgua > 28.0) {
          const act = getHumanActions('temperatura', 'high');
          if (act) humanActions.push(act);
        } else if (params.temperaturaAgua < 18.0) {
          const act = getHumanActions('temperatura', 'low');
          if (act) humanActions.push(act);
        }
        const nivelCm = Number(((params.nivelAgua / 100) * 32).toFixed(1));
        if (params.nivelAgua < 25.0 || nivelCm < 10.0) {
          const act = getHumanActions('nivelAgua', 'low');
          if (act) humanActions.push(act);
        } else if (params.nivelAgua > 92.0 || nivelCm > 32.0) {
          const act = getHumanActions('nivelAgua', 'high');
          if (act) humanActions.push(act);
        }
        if (params.electroconductividad < 0.8) {
          const act = getHumanActions('electroconductividad', 'low');
          if (act) humanActions.push(act);
        } else if (params.electroconductividad > 2.0) {
          const act = getHumanActions('electroconductividad', 'high');
          if (act) humanActions.push(act);
        }
        if (params.turbidez > 25.0) {
          const act = getHumanActions('turbiedad', 'high');
          if (act) humanActions.push(act);
        }
        explanations.humanActions = humanActions;

        const telegramLines = [
          `${icon} <b>Alerta Inmediata · Desbalance en Ecosistema Acuapónico</b>`,
          ``,
          `<b>Diagnóstico TypeSafe:</b> ${statusLabel}`,
          `<b>Resiliencia del Sistema:</b> ${stabilityScore}% (${result.stabilityLevel})`,
          `<b>Lecturas:</b> pH ${params.ph.toFixed(2)} | OD ${params.oxigenoDisuelto.toFixed(1)} mg/L | Temp ${params.temperaturaAgua.toFixed(1)}°C | Nivel ${params.nivelAgua.toFixed(0)}% (${nivelCm.toFixed(1)} cm) | EC ${params.electroconductividad.toFixed(2)} | Turb ${params.turbidez.toFixed(1)} NTU`,
          ``,
          `<b>Decisiones IoT:</b>`,
          ...iotDecisions.map((d) => `• <b>${d.actuatorLabel}:</b> ${d.proposedAction.toUpperCase()} (${d.reason})`),
          ``,
          `<b>Fundamento Biológico:</b> ${explanations.iotDecisionRationale}`,
        ];

        if (humanActions.length > 0) {
          telegramLines.push(``);
          telegramLines.push(`<b>Acciones que debe realizar un humano:</b>`);
          humanActions.forEach((h) => {
            telegramLines.push(`• <b>${h.parameter}:</b>`);
            h.actions.forEach((a) => telegramLines.push(`  - ${a}`));
          });
        }

        const telegramText = telegramLines.join('\n');

        if (this.telegram) {
          void this.telegram.send({ text: telegramText });
        }

        if (this.mail) {
          void this.mail.send({
            subject: `[Aquaponía TypeSafe] ${statusLabel} (${stabilityScore}% Resiliencia)`,
            text: explanations.summary,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
                <div style="background: ${overallStatus === 'critical' ? '#DC2626' : '#D97706'}; color: #fff; padding: 18px 24px;">
                  <h1 style="margin: 0; font-size: 18px;">Alerta Inmediata de Desbalance · TypeSafe AI</h1>
                </div>
                <div style="padding: 24px; color: #111;">
                  <p style="font-size: 16px; font-weight: bold; margin-top: 0;">${statusLabel} (Resiliencia: ${stabilityScore}%)</p>
                  <p>${explanations.summary}</p>
                  <h3>Química del Agua:</h3>
                  <p>${explanations.waterChemistryAnalysis}</p>
                  <h3>Decisiones IoT:</h3>
                  <ul>
                    ${iotDecisions.map((d) => `<li><b>${d.actuatorLabel}:</b> ${d.proposedAction.toUpperCase()} — ${d.reason} (Evidencia: ${d.biologicalEvidence})</li>`).join('')}
                  </ul>

                  ${humanActions.length > 0 ? `
                    <div style="margin-top: 18px; padding: 16px; background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px;">
                      <h3 style="margin: 0 0 10px; color: #92400E; font-size: 14px;">Acciones que debe realizar un humano:</h3>
                      ${humanActions.map((h) => `
                        <div style="margin-bottom: 10px;">
                          <strong style="color: #B45309; font-size: 13px;">${h.parameter} (${h.condition}):</strong>
                          <ul style="margin: 4px 0 0; padding-left: 18px; color: #78350F; font-size: 12px; line-height: 1.5;">
                            ${h.actions.map((act) => `<li>${act}</li>`).join('')}
                          </ul>
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}

                  <p style="color: #666; font-size: 12px; margin-top: 16px;">Evaluado mediante TypeSafe AI</p>
                </div>
              </div>
            `,
          });
        }

        if (this.alerts) {
          const nivelCm = Number(((params.nivelAgua / 100) * 32).toFixed(1));
          this.alerts.notifyManual({
            sensors: {
              ph: { value: params.ph },
              oxigeno: { value: params.oxigenoDisuelto },
              temperatura: { value: params.temperaturaAgua },
              nivelAgua: { value: nivelCm },
              electroconductividad: { value: params.electroconductividad },
              turbiedad: { value: params.turbidez },
            },
          });
        }
      }
    }

    return result;
  }

  /**
   * Construye el esquema de las 29 preguntas estrictas para TypeSafe AI.
   * - 3 preguntas por cada uno de los 8 parámetros físicos y biológicos (24).
   * - 5 preguntas de integración holística del sistema total.
   */
  private buildQuestionsSchema(): Record<string, any> {
    return {
      // -------------------------------------------------------------
      // 1. PARÁMETRO: pH (3 Preguntas)
      // -------------------------------------------------------------
      ph_regimen_quimico: choice(
        'Clasifica el régimen fisicoquímico del pH del agua y su seguridad biológica:',
        {
          acidez_critica_letal: 'pH < 5.5. Acidez crítica letal; daño cáustico en epitelio branquial y disolución de carbonatos.',
          acidez_moderada: 'pH 5.5 - 6.4. Acidez subóptima; bloqueo de fósforo/calcio y reducción de bacterias nitrificantes.',
          neutro_optimo: 'pH 6.5 - 7.4. Rango neutral óptimo de máxima compatibilidad entre peces, biofiltro y hortalizas.',
          alcalosis_moderada: 'pH 7.5 - 8.2. Alcalosis moderada; precipitación de quelato de hierro produciendo clorosis foliar.',
          alcalinidad_toxica_letal: 'pH > 8.2. Alcalinidad peligrosa; desbalance iónico agudo y toxicidad severa por amoníaco libre.',
        },
      ),
      ph_actividad_bacteriana_nitrificacion: choice(
        'Evalúa el impacto del pH sobre la actividad metabólica de Nitrosomonas y Nitrobacter en el biofiltro:',
        {
          inhibicion_severa_por_acidez: 'pH < 6.0 inhibe más del 70% de la actividad enzimática nitrificante; riesgo de acumulación de amonio.',
          actividad_optima: 'pH 6.8 - 7.5 brinda la cinética de oxidación de amonio a nitrato más eficiente y estable.',
          desaceleracion_por_alcalinidad: 'pH > 8.0 altera el equilibrio de disociación y estresa a las bacterias depuradoras.',
        },
      ),
      ph_riesgo_amoniaco_toxico: choice(
        'Calcula el riesgo de disociación del ion amonio (NH4+) a amoníaco no ionizado letal (NH3) según el pH actual:',
        {
          riesgo_amoniaco_despreciable: 'pH <= 7.2. El nitrógeno amoniacal se mantiene como NH4+ inocuo; toxicidad nula.',
          riesgo_amoniaco_alerta_moderada: 'pH 7.3 - 7.9. Fracción no ionizada NH3 entre 1% y 3%; estrés osmótico incipiente en peces.',
          toxicidad_aguda_nh3_letal: 'pH >= 8.0 combinado con temperatura acuícola. Fracción de NH3 > 5%, altamente neurotóxica.',
        },
      ),

      // -------------------------------------------------------------
      // 2. PARÁMETRO: Oxígeno Disuelto (OD) (3 Preguntas)
      // -------------------------------------------------------------
      od_estado_respiratorio: choice(
        'Diagnostica el estado respiratorio acuático del tanque según la concentración de oxígeno disuelto:',
        {
          hipoxia_anoxica_letal: 'OD < 3.2 mg/L. Asfixia aguda en peces y mortandad inminente por anoxia celular.',
          hipoxia_subletal_estres: 'OD 3.2 - 4.9 mg/L. Respiración agitada, pérdida completa de apetito y fatiga metabólica.',
          normoxia_optima: 'OD 5.0 - 8.5 mg/L. Saturación respiratoria ideal para natación activa y desarrollo vigoroso.',
          sobresaturacion: 'OD > 8.5 mg/L. Sobresaturación gaseosa; monitoreo preventivo de enfermedad de la burbuja.',
        },
      ),
      od_urgencia_aireacion: choice(
        'Determina la demanda de encendido y potencia requerida para el aireador mecánico de oxígeno:',
        {
          aireador_innecesario: 'OD >= 5.5 mg/L. Oxigenación basal abundante; mantener aireador apagado para ahorro energético.',
          aireador_activacion_preventiva: 'OD 4.5 - 5.4 mg/L. Activar aireador en modo continuo preventivo para frenar el declive nocturno.',
          aireador_emergencia_maxima: 'OD < 4.5 mg/L o boqueo en superficie. Activar aireador a potencia máxima inmediata.',
        },
      ),
      od_respiracion_radicular_biofiltro: choice(
        'Evalúa el suministro de oxígeno para la respiración radicular de las plantas y la biopelícula nitrificante:',
        {
          asfixia_radicular_anaerobiosis: 'OD < 3.5 mg/L. Anoxia en cama hidropónica; proliferación de patógenos anaerobios y pérdida de raíz.',
          oxidacion_limitada: 'OD 3.5 - 5.0 mg/L. Respiración radicular comprometida y menor tasa de conversión aeróbica de nitritos.',
          oxidacion_y_oxigenacion_plena: 'OD >= 5.0 mg/L. Óptima absorción activa de nutrientes y biofiltro completamente oxigenado.',
        },
      ),

      // -------------------------------------------------------------
      // 3. PARÁMETRO: Temperatura del Agua (3 Preguntas)
      // -------------------------------------------------------------
      temp_confort_metabolico_peces: choice(
        'Evalúa el estado metabólico y homeotérmico de los peces según la temperatura del agua:',
        {
          letargo_hipotermico: 'Temp < 18°C. Depresión metabólica severa, cese de alimentación e inmunosupresión.',
          confort_metabolico_optimo: 'Temp 22 - 28°C. Rango de máxima conversión alimenticia, crecimiento y vitalidad para tilapia.',
          estres_calorico_acelerado: 'Temp 28.5 - 31°C. Metabolismo acelerado con consumo disparado de oxígeno y fatiga celular.',
          hipertermia_letal: 'Temp > 31°C. Estrés oxidativo extremo, daño a branquias y riesgo letal de colapso.',
        },
      ),
      temp_solubilidad_oxigeno: choice(
        'Analiza la ley de Henry sobre la capacidad de disolución y solubilidad física de gases en el agua:',
        {
          alta_solubilidad_agua_fria: 'Temp < 21°C. Mayor solubilidad física de oxígeno; retención prolongada en disolución.',
          equilibrio_solubilidad_normal: 'Temp 21 - 27°C. Solubilidad estándar en equilibrio térmico normal con la atmósfera.',
          desgasificacion_y_baja_solubilidad_calor: 'Temp > 27°C. Pérdida rápida de O2 disuelto al aire; demanda de aireación mecánica incrementada.',
        },
      ),
      temp_riesgo_patogenos_radiculares: choice(
        'Determina la predisposición a enfermedades micóticas radiculares (Pythium) según la temperatura acuática:',
        {
          proliferacion_fungica_baja_temp: 'Temp < 19°C. Crecimiento vegetal lento con vulnerabilidad a mohos de agua fría.',
          microclima_radicular_equilibrado: 'Temp 20 - 26°C. Relación raíz-microbioma en equilibrio protector sin estrés radicular.',
          peligro_pythium_pudricion_calor: 'Temp > 27°C. Calor favorece zoosporas de Pythium y pudrición parda de raíces.',
        },
      ),

      // -------------------------------------------------------------
      // 4. PARÁMETRO: Nivel de Agua y Reservorio (3 Preguntas)
      // -------------------------------------------------------------
      nivel_seguridad_bomba: choice(
        'Evalúa el riesgo de cavitación, entrada de aire y marcha en seco en la bomba sumergible de recirculación:',
        {
          peligro_cavitacion_marcha_seco: 'Nivel < 25%. Peligro inminente de destrucción del rodete y quemado del devanado del motor.',
          nivel_bajo_precaucion: 'Nivel 25 - 40%. Margen de seguridad reducido; riesgo de succión de burbujas en el vórtice.',
          nivel_seguro_optimo: 'Nivel > 40%. Carga hidrostática holgada para refrigeración y trabajo continuo de la bomba.',
        },
      ),
      nivel_estabilidad_hidraulica: choice(
        'Analiza la dinámica volumétrica del sistema y la estabilidad del flujo recirculante:',
        {
          volumen_depletado_critico: 'Nivel < 30%. Volumen total insuficiente para amortiguar picos químicos y térmicos del ecosistema.',
          flujo_recirculante_estable: 'Nivel 30 - 88%. Balance hidrodinámico adecuado entre tanque, biofiltro y camas de cultivo.',
          riesgo_desbordamiento_rebose: 'Nivel > 88%. Cerca de la cota máxima del rebosadero; riesgo inminente de derrame en caso de lluvia.',
        },
      ),
      nivel_urgencia_recarga: choice(
        'Dictamina la urgencia de reponer agua desclorada o ejecutar apagado de protección de equipos:',
        {
          corte_emergencia_bomba_y_llenado: 'Nivel < 25%. Desconectar bomba de inmediato y abrir válvula de reposición urgente.',
          reposicion_programada_preventiva: 'Nivel 25 - 45%. Programar adición de agua fresca para compensar evapotranspiración.',
          volumen_autosuficiente: 'Nivel > 45%. Reservorio autosuficiente sin requerimiento de intervención humana.',
        },
      ),

      // -------------------------------------------------------------
      // 5. PARÁMETRO: Electroconductividad (EC / Nutrientes) (3 Preguntas)
      // -------------------------------------------------------------
      ec_fertilidad_solucion_nutritiva: choice(
        'Evalúa la concentración de sales disueltas y fertilidad de la solución para las camas hidropónicas:',
        {
          desnutricion_por_baja_ec: 'EC < 0.8 mS/cm. Inanición nutricional en plantas; escasa mineralización de nitrógeno, fósforo y potasio.',
          fertilidad_equilibrada_optima: 'EC 0.8 - 2.2 mS/cm. Concentración iónica óptima para hortalizas de hoja verde y aromáticas.',
          salinidad_excesiva_estres: 'EC > 2.2 mS/cm. Acumulación salina desmedida; riesgo de fitotoxicidad y quema marginal de hojas.',
        },
      ),
      ec_presion_osmotica_raices: choice(
        'Determina la presión osmótica ejercida sobre las células radiculares de las plantas cultivadas:',
        {
          absorcion_hidrica_fluida: 'EC 0.8 - 1.6 mS/cm. Gradiente osmótico natural; transporte pasivo y activo de agua sin resistencia.',
          gradiente_osmotico_equilibrado: 'EC 1.6 - 2.2 mS/cm. Turgencia celular equilibrada con adecuado gasto de energía metabólica.',
          plasmolisis_quemadura_radicular: 'EC > 2.2 mS/cm. Salinidad extrema invierte el gradiente osmótico provocando plasmólisis radicular.',
        },
      ),
      ec_osmorregulacion_peces: choice(
        'Analiza la exigencia de osmorregulación branquial en los peces según la carga iónica del agua:',
        {
          osmorregulacion_estable_saludable: 'EC 0.8 - 1.8 mS/cm. Ambiente osmótico sumamente cómodo para tilapia y peces dulceacuícolas.',
          osmorregulacion_exigida: 'EC 1.8 - 2.4 mS/cm. Gasto energético elevado en bombeo iónico branquial; ligero estrés metabólico.',
          estres_osmotico_branquial: 'EC > 2.4 mS/cm. Deshidratación celular branquial por carga salina inusualmente alta.',
        },
      ),

      // -------------------------------------------------------------
      // 6. PARÁMETRO: Turbidez y Sólidos Suspendidos (3 Preguntas)
      // -------------------------------------------------------------
      turbidez_claridad_solidos: choice(
        'Clasifica el grado de partículas coloidales y sólidos suspendidos totales (TSS) en el agua:',
        {
          agua_cristalina_optima: 'Turbidez < 10 NTU. Agua translúcida y sedimentación eficiente sin turbiedad perceptible.',
          turbidez_moderada_aceptable: 'Turbidez 10 - 25 NTU. Presencia de floc bacteriano y detritos finos en rango biológico tolerable.',
          turbidez_critica_exceso_solidos: 'Turbidez > 25 NTU. Sobrecarga de heces y lodos no clarificados enturbiando la columna de agua.',
        },
      ),
      turbidez_salud_branquial: choice(
        'Evalúa el impacto físico de las partículas en suspensión sobre el epitelio y lamelas branquiales de los peces:',
        {
          branquias_limpias_sin_sedimento: 'Turbidez < 12 NTU. Superficie branquial despejada para intercambio gaseoso pleno.',
          irritacion_branquial_leve: 'Turbidez 12 - 25 NTU. Estimulación de mucosidad protectora sin daño tisular permanente.',
          oclusion_mecanica_severa: 'Turbidez > 25 NTU. Adherencia de sedimentos a filamentos branquiales; riesgo de necrosis e infección.',
        },
      ),
      turbidez_saturacion_filtro_mecanico: choice(
        'Dictamina el estado de saturación del clarificador mecánico / sedimentador de vórtice:',
        {
          filtro_limpio_flujo_normal: 'Turbidez < 10 NTU. Filtro mecánico y mallas clarificadoras operando con paso de agua despejado.',
          advertencia_limpieza_filtro: 'Turbidez 10 - 25 NTU. Lodos acumulados en la base del decantador; programar purga preventiva.',
          colmatacion_inminente_requiere_purga: 'Turbidez > 25 NTU. Filtro mecánico saturado; requiere purga y limpieza de mallas inmediata.',
        },
      ),

      // -------------------------------------------------------------
      // 7. PARÁMETRO: Salud y Biomasa de Plantas (3 Preguntas)
      // -------------------------------------------------------------
      plantas_vigor_follaje: choice(
        'Diagnostica el vigor fenológico, turgencia y coloración de las hojas en las camas hidropónicas:',
        {
          follaje_vigoroso_verde_intenso: 'Hojas turgentes, índice verde alto y desarrollo vegetativo exuberante sin lesiones.',
          clorosis_o_deficiencia_incipiente: 'Amarillamiento foliar intervenal o pérdida de vigor celular en hojas maduras.',
          necrosis_o_marchitamiento_grave: 'Bordes foliares quemados, marchitamiento vascular o senescencia celular avanzada.',
        },
      ),
      plantas_asimilacion_nutricional: choice(
        'Evalúa la biodisponibilidad y absorción de macronutrientes y hierro según las condiciones del lecho:',
        {
          asimilacion_plena_optima: 'pH y balance químico favorecen absorción equilibrada de NO3, P, K, Ca, Mg y Fe.',
          bloqueo_hierro_por_alcalinidad: 'pH elevado (> 7.5) precipita iones férricos generando clorosis apical severa.',
          bloqueo_fosforo_por_acidez: 'pH ácido (< 6.0) insolubiliza fosfatos con complejos metálicos, frenando crecimiento.',
          inanicion_por_solucion_pobre: 'Baja conductividad general genera deficiencia difusa por falta de sales en el medio.',
        },
      ),
      plantas_integridad_sistema_radicular: choice(
        'Determina la condición de salud de la zona radicular sumergida en las bateas hidropónicas:',
        {
          raices_blancas_sanas_y_oxigenadas: 'Raíces abundantes, color blanco aperlado, sin indicios de anoxia ni olores desagradables.',
          asfixia_radicular_incipiente: 'Raíces amarronadas por déficit de aireación o exceso de sedimentos adheridos.',
          pudricion_radicular_activa: 'Desprendimiento de corteza radicular, consistencia viscosa y ataque fúngico activo (Pythium).',
        },
      ),

      // -------------------------------------------------------------
      // 8. PARÁMETRO: Comportamiento y Biomasa de Peces (3 Preguntas)
      // -------------------------------------------------------------
      peces_patron_natatorio: choice(
        'Evalúa el patrón conductual y etológico observado en los peces del estanque acuapónico:',
        {
          natacion_activa_homogenea: 'Cardumen distribuido en la columna media, nado ágil, alerta al movimiento externo.',
          letargo_fondo_hipotermia: 'Peces apelmazados en el fondo con baja reactividad; síntoma de frío o estrés prolongado.',
          aglomeracion_superficie_boqueo: 'Peces boqueando desesperadamente en la superficie del agua ("piping"); hipoxia aguda crítica.',
          nado_erratico_toxicidad: 'Nado en tirabuzón, saltos bruscos o pérdida de balance; signo inequívoco de intoxicación química.',
        },
      ),
      peces_seguridad_alimentaria: choice(
        'Dictamina si es biológicamente seguro alimentar a los peces según el balance metabólico y respiratorio:',
        {
          alimentacion_autorizada_segura: 'Condiciones excelentes (OD >= 5.0, pH 6.5-7.8, T 20-28°C). Ración alimentaria recomendada.',
          suspension_por_hipoxia_asfixia: 'OD insuficiente (< 5.0 mg/L). Alimentar aumentaría la demanda de oxígeno digestivo y provocaría asfixia.',
          suspension_por_estres_termico: 'Temperatura extrema (< 18°C o > 29.5°C). Parálisis o depresión enzimática gastrointestinal.',
          suspension_por_toxicidad_quimica: 'pH anormal o picos de amonio. Alimentar multiplicaría la excreción branquial de amoníaco tóxico.',
        },
      ),
      peces_carga_biologica_bienestar: choice(
        'Diagnostica el índice general de bienestar biológico y bioseguridad del cardumen:',
        {
          bienestar_alto_sin_estres: 'Cardumen vigoroso con función inmune activa y libre de amenazas de mortalidad.',
          estres_fisiologico_moderado: 'Estrés acumulativo que debilita la capa mucosa y expone a patógenos oportunistas.',
          riesgo_mortalidad_inminente: 'Colapso fisiológico agudo; peligro inminente de mortandad masiva si no se interviene.',
        },
      ),

      // -------------------------------------------------------------
      // 9. INTEGRACIÓN HOLÍSTICA: Preguntas que juntan TODO el sistema (5 Preguntas)
      // -------------------------------------------------------------
      sistema_balance_ecosistema_global: choice(
        'Evalúa la sincronización holística y resiliencia entre peces, plantas, biofiltro y agua. Si los parámetros están dentro de rangos óptimos (pH 6.5-7.4, OD >= 5.0, temp 21-28, nivel >= 70%), el balance es equilibrio_armonico_perfecto:',
        {
          equilibrio_armonico_perfecto: 'Todos los parámetros fisicoquímicos y biológicos en rango óptimo. Sinergia simbiótica plena; los desechos de peces nutren plantas y el agua recircula pura.',
          desbalance_compensable: 'Parámetros con desviaciones reales fuera de rango (ej. pH fuera de 6.5-7.4, OD < 5 mg/L, amoníaco elevado) amortiguadas por el biofiltro.',
          descompensacion_sistemica: 'Múltiples variables alteradas simultáneamente comprometiendo ambos reinos biológicos.',
          colapso_inminente_multivariable: 'Falla cruzada catastrófica (ej. anoxia + acidez + fallo de nivel); parada e intervención perentoria.',
        },
      ),
      sistema_salud_biofiltro_nitrificacion: choice(
        'Diagnostica la resiliencia integral del ciclo del nitrógeno considerando pH, OD, Temp y carga biológica:',
        {
          biofiltro_robusto_depuracion_plena: 'Conversión estequiométrica total de amonio a nitrato sin acumulación de nitritos intermediarios.',
          biofiltro_estresado_reduccion_eficiencia: 'Factores fisicoquímicos adversos reducen la tasa de nitrificación entre 30% y 60%.',
          biofiltro_colapsado_falla_depuracion: 'Biofiltro inhibido por acidez extrema o anoxia; peligro de pico letal de nitritos y amonio.',
        },
      ),
      sistema_orquestacion_actuadores: choice(
        'Define la estrategia de coordinación de hardware IoT para salvaguardar la vida y la infraestructura:',
        {
          operacion_nominal_balanceada: 'Bomba recirculando con caudal continuo, aireación en régimen estándar y alimentación activa.',
          prioridad_oxigenacion_emergencia: 'Aireación forzada al 100%, dispensador bloqueado preventivamente y bomba encendida para mezcla.',
          parada_proteccion_bomba: 'Apagado inmediato de bomba de agua por cota crítica para evitar destrucción mecánica.',
          protocolo_recuperacion_total: 'Acción combinada de emergencia: aireador continuo, bomba apagada si nivel bajo y alimentación cortada.',
        },
      ),
      sistema_accion_prioritaria: choice(
        'Identifica la acción física prioritaria número 1 que el operador o el sistema debe acometer de inmediato:',
        {
          mantener_rutina_actual: 'Ninguna acción extraordinaria requerida; mantener monitoreo telemétrico continuo.',
          maximizar_aireacion_inmediata: 'Encender aireador mecánico y revisar difusores por peligro inminente de hipoxia.',
          apagar_bomba_y_rellenar_agua: 'Desconectar bomba hidráulica y reponer agua fresca en el reservorio de sumidero.',
          suspender_alimentacion_y_revisar_ph: 'Bloquear dispensador de alimento y dosificar buffer correctivo (carbonato de potasio / ácido suave).',
          purgar_solidos_y_limpiar_filtros: 'Drenar lodos del clarificador mecánico para reducir la carga coloidal suspendida.',
        },
      ),
      sistema_indice_resiliencia: score(
        'Puntúa la resiliencia y salud ecosistémica global del sistema acuapónico de 0 a 4 (4.0=Equilibrio simbiótico perfecto con todos los parámetros en rango óptimo; 3.0=Estable y operativo; 2.0=Desbalance moderado; 0-1=Riesgo crítico):',
        [
          '0 - Emergencia/Colapso inminente multivariable',
          '1 - Riesgo severo agudo en múltiples parámetros',
          '2 - Desbalance moderado compensable',
          '3 - Estable y operativo con buen margen de resiliencia',
          '4 - Equilibrio biológico simbiótico perfecto con parámetros óptimos',
        ],
      ),
    };
  }

  /**
   * Motor de inferencia determinista local con reglas biológicas y fisicoquímicas
   * de máxima precisión acuapónica para las 29 preguntas.
   */
  private runLocalDeterministicInference(params: TypeSafeEvaluationParams): Record<string, any> {
    const {
      ph,
      oxigenoDisuelto: od,
      temperaturaAgua: temp,
      nivelAgua: nivel,
      electroconductividad: ec,
      turbidez: turb,
      plantStatus,
      fishStatus,
    } = params;

    const answers: Record<string, any> = {};

    // 1. pH (3 Preguntas)
    // 1.1 Régimen químico
    let phRegimen = 'neutro_optimo';
    let phRegimenProbs = { acidez_critica_letal: 0.01, acidez_moderada: 0.04, neutro_optimo: 0.9, alcalosis_moderada: 0.04, alcalinidad_toxica_letal: 0.01 };
    if (ph < 5.5) {
      phRegimen = 'acidez_critica_letal';
      phRegimenProbs = { acidez_critica_letal: 0.92, acidez_moderada: 0.06, neutro_optimo: 0.01, alcalosis_moderada: 0.01, alcalinidad_toxica_letal: 0 };
    } else if (ph < 6.5) {
      phRegimen = 'acidez_moderada';
      phRegimenProbs = { acidez_critica_letal: 0.05, acidez_moderada: 0.88, neutro_optimo: 0.06, alcalosis_moderada: 0.01, alcalinidad_toxica_letal: 0 };
    } else if (ph > 8.2) {
      phRegimen = 'alcalinidad_toxica_letal';
      phRegimenProbs = { acidez_critica_letal: 0, acidez_moderada: 0.01, neutro_optimo: 0.01, alcalosis_moderada: 0.08, alcalinidad_toxica_letal: 0.9 };
    } else if (ph > 7.4) {
      phRegimen = 'alcalosis_moderada';
      phRegimenProbs = { acidez_critica_letal: 0, acidez_moderada: 0.02, neutro_optimo: 0.12, alcalosis_moderada: 0.84, alcalinidad_toxica_letal: 0.02 };
    }
    answers.ph_regimen_quimico = { type: 'choice', choice: phRegimen, confidence: (phRegimenProbs as any)[phRegimen], probabilities: phRegimenProbs };

    // 1.2 Biofiltro nitrificación
    let phBiofiltro = 'actividad_optima';
    let phBioProbs = { inhibicion_severa_por_acidez: 0.02, actividad_optima: 0.94, desaceleracion_por_alcalinidad: 0.04 };
    if (ph < 6.0) {
      phBiofiltro = 'inhibicion_severa_por_acidez';
      phBioProbs = { inhibicion_severa_por_acidez: 0.92, actividad_optima: 0.07, desaceleracion_por_alcalinidad: 0.01 };
    } else if (ph > 8.0) {
      phBiofiltro = 'desaceleracion_por_alcalinidad';
      phBioProbs = { inhibicion_severa_por_acidez: 0.03, actividad_optima: 0.12, desaceleracion_por_alcalinidad: 0.85 };
    }
    answers.ph_actividad_bacteriana_nitrificacion = { type: 'choice', choice: phBiofiltro, confidence: (phBioProbs as any)[phBiofiltro], probabilities: phBioProbs };

    // 1.3 Amoníaco tóxico
    let phAmoniaco = 'riesgo_amoniaco_despreciable';
    let phNh3Probs = { riesgo_amoniaco_despreciable: 0.93, riesgo_amoniaco_alerta_moderada: 0.06, toxicidad_aguda_nh3_letal: 0.01 };
    if (ph >= 8.0 || (ph >= 7.8 && temp > 28)) {
      phAmoniaco = 'toxicidad_aguda_nh3_letal';
      phNh3Probs = { riesgo_amoniaco_despreciable: 0.02, riesgo_amoniaco_alerta_moderada: 0.1, toxicidad_aguda_nh3_letal: 0.88 };
    } else if (ph >= 7.3) {
      phAmoniaco = 'riesgo_amoniaco_alerta_moderada';
      phNh3Probs = { riesgo_amoniaco_despreciable: 0.12, riesgo_amoniaco_alerta_moderada: 0.84, toxicidad_aguda_nh3_letal: 0.04 };
    }
    answers.ph_riesgo_amoniaco_toxico = { type: 'choice', choice: phAmoniaco, confidence: (phNh3Probs as any)[phAmoniaco], probabilities: phNh3Probs };

    // 2. Oxígeno Disuelto (3 Preguntas)
    // 2.1 Estado respiratorio
    let odEstado = 'normoxia_optima';
    let odEstProbs = { hipoxia_anoxica_letal: 0.01, hipoxia_subletal_estres: 0.04, normoxia_optima: 0.92, sobresaturacion: 0.03 };
    if (od < 3.2 || fishStatus === 'surface_crowding') {
      odEstado = 'hipoxia_anoxica_letal';
      odEstProbs = { hipoxia_anoxica_letal: 0.94, hipoxia_subletal_estres: 0.05, normoxia_optima: 0.01, sobresaturacion: 0 };
    } else if (od < 5.0) {
      odEstado = 'hipoxia_subletal_estres';
      odEstProbs = { hipoxia_anoxica_letal: 0.06, hipoxia_subletal_estres: 0.86, normoxia_optima: 0.08, sobresaturacion: 0 };
    } else if (od > 8.5) {
      odEstado = 'sobresaturacion';
      odEstProbs = { hipoxia_anoxica_letal: 0, hipoxia_subletal_estres: 0.01, normoxia_optima: 0.15, sobresaturacion: 0.84 };
    }
    answers.od_estado_respiratorio = { type: 'choice', choice: odEstado, confidence: (odEstProbs as any)[odEstado], probabilities: odEstProbs };

    // 2.2 Urgencia aireación
    let odAireacion = 'aireador_innecesario';
    let odAirProbs = { aireador_innecesario: 0.91, aireador_activacion_preventiva: 0.07, aireador_emergencia_maxima: 0.02 };
    if (od < 4.5 || fishStatus === 'surface_crowding') {
      odAireacion = 'aireador_emergencia_maxima';
      odAirProbs = { aireador_innecesario: 0.01, aireador_activacion_preventiva: 0.06, aireador_emergencia_maxima: 0.93 };
    } else if (od < 5.5) {
      odAireacion = 'aireador_activacion_preventiva';
      odAirProbs = { aireador_innecesario: 0.07, aireador_activacion_preventiva: 0.87, aireador_emergencia_maxima: 0.06 };
    }
    answers.od_urgencia_aireacion = { type: 'choice', choice: odAireacion, confidence: (odAirProbs as any)[odAireacion], probabilities: odAirProbs };

    // 2.3 Raíces y biofiltro
    let odRaices = 'oxidacion_y_oxigenacion_plena';
    let odRaizProbs = { asfixia_radicular_anaerobiosis: 0.02, oxidacion_limitada: 0.05, oxidacion_y_oxigenacion_plena: 0.93 };
    if (od < 3.5) {
      odRaices = 'asfixia_radicular_anaerobiosis';
      odRaizProbs = { asfixia_radicular_anaerobiosis: 0.91, oxidacion_limitada: 0.08, oxidacion_y_oxigenacion_plena: 0.01 };
    } else if (od < 5.0) {
      odRaices = 'oxidacion_limitada';
      odRaizProbs = { asfixia_radicular_anaerobiosis: 0.08, oxidacion_limitada: 0.85, oxidacion_y_oxigenacion_plena: 0.07 };
    }
    answers.od_respiracion_radicular_biofiltro = { type: 'choice', choice: odRaices, confidence: (odRaizProbs as any)[odRaices], probabilities: odRaizProbs };

    // 3. Temperatura (3 Preguntas)
    // 3.1 Confort metabólico
    let tempConfort = 'confort_metabolico_optimo';
    let tempConfProbs = { letargo_hipotermico: 0.02, confort_metabolico_optimo: 0.92, estres_calorico_acelerado: 0.05, hipertermia_letal: 0.01 };
    if (temp < 18) {
      tempConfort = 'letargo_hipotermico';
      tempConfProbs = { letargo_hipotermico: 0.9, confort_metabolico_optimo: 0.08, estres_calorico_acelerado: 0.01, hipertermia_letal: 0.01 };
    } else if (temp > 31) {
      tempConfort = 'hipertermia_letal';
      tempConfProbs = { letargo_hipotermico: 0, confort_metabolico_optimo: 0.02, estres_calorico_acelerado: 0.12, hipertermia_letal: 0.86 };
    } else if (temp > 28) {
      tempConfort = 'estres_calorico_acelerado';
      tempConfProbs = { letargo_hipotermico: 0.01, confort_metabolico_optimo: 0.14, estres_calorico_acelerado: 0.82, hipertermia_letal: 0.03 };
    }
    answers.temp_confort_metabolico_peces = { type: 'choice', choice: tempConfort, confidence: (tempConfProbs as any)[tempConfort], probabilities: tempConfProbs };

    // 3.2 Solubilidad oxígeno
    let tempSolub = 'equilibrio_solubilidad_normal';
    let tempSolProbs = { alta_solubilidad_agua_fria: 0.05, equilibrio_solubilidad_normal: 0.9, desgasificacion_y_baja_solubilidad_calor: 0.05 };
    if (temp < 21) {
      tempSolub = 'alta_solubilidad_agua_fria';
      tempSolProbs = { alta_solubilidad_agua_fria: 0.88, equilibrio_solubilidad_normal: 0.1, desgasificacion_y_baja_solubilidad_calor: 0.02 };
    } else if (temp > 27) {
      tempSolub = 'desgasificacion_y_baja_solubilidad_calor';
      tempSolProbs = { alta_solubilidad_agua_fria: 0.02, equilibrio_solubilidad_normal: 0.12, desgasificacion_y_baja_solubilidad_calor: 0.86 };
    }
    answers.temp_solubilidad_oxigeno = { type: 'choice', choice: tempSolub, confidence: (tempSolProbs as any)[tempSolub], probabilities: tempSolProbs };

    // 3.3 Patógenos radiculares
    let tempPatog = 'microclima_radicular_equilibrado';
    let tempPatProbs = { proliferacion_fungica_baja_temp: 0.04, microclima_radicular_equilibrado: 0.91, peligro_pythium_pudricion_calor: 0.05 };
    if (temp > 27) {
      tempPatog = 'peligro_pythium_pudricion_calor';
      tempPatProbs = { proliferacion_fungica_baja_temp: 0.01, microclima_radicular_equilibrado: 0.11, peligro_pythium_pudricion_calor: 0.88 };
    } else if (temp < 19) {
      tempPatog = 'proliferacion_fungica_baja_temp';
      tempPatProbs = { proliferacion_fungica_baja_temp: 0.85, microclima_radicular_equilibrado: 0.12, peligro_pythium_pudricion_calor: 0.03 };
    }
    answers.temp_riesgo_patogenos_radiculares = { type: 'choice', choice: tempPatog, confidence: (tempPatProbs as any)[tempPatog], probabilities: tempPatProbs };

    // 4. Nivel de Agua (3 Preguntas)
    // 4.1 Seguridad bomba
    let nivelBomba = 'nivel_seguro_optimo';
    let nivelBombaProbs = { peligro_cavitacion_marcha_seco: 0.02, nivel_bajo_precaucion: 0.06, nivel_seguro_optimo: 0.92 };
    if (nivel < 25) {
      nivelBomba = 'peligro_cavitacion_marcha_seco';
      nivelBombaProbs = { peligro_cavitacion_marcha_seco: 0.94, nivel_bajo_precaucion: 0.05, nivel_seguro_optimo: 0.01 };
    } else if (nivel < 40) {
      nivelBomba = 'nivel_bajo_precaucion';
      nivelBombaProbs = { peligro_cavitacion_marcha_seco: 0.1, nivel_bajo_precaucion: 0.83, nivel_seguro_optimo: 0.07 };
    }
    answers.nivel_seguridad_bomba = { type: 'choice', choice: nivelBomba, confidence: (nivelBombaProbs as any)[nivelBomba], probabilities: nivelBombaProbs };

    // 4.2 Dinámica hidráulica
    let nivelHidro = 'flujo_recirculante_estable';
    let nivelHidroProbs = { volumen_depletado_critico: 0.04, flujo_recirculante_estable: 0.92, riesgo_desbordamiento_rebose: 0.04 };
    if (nivel < 30) {
      nivelHidro = 'volumen_depletado_critico';
      nivelHidroProbs = { volumen_depletado_critico: 0.91, flujo_recirculante_estable: 0.08, riesgo_desbordamiento_rebose: 0.01 };
    } else if (nivel > 88) {
      nivelHidro = 'riesgo_desbordamiento_rebose';
      nivelHidroProbs = { volumen_depletado_critico: 0.01, flujo_recirculante_estable: 0.14, riesgo_desbordamiento_rebose: 0.85 };
    }
    answers.nivel_estabilidad_hidraulica = { type: 'choice', choice: nivelHidro, confidence: (nivelHidroProbs as any)[nivelHidro], probabilities: nivelHidroProbs };

    // 4.3 Urgencia recarga
    let nivelRecarga = 'volumen_autosuficiente';
    let nivelRecProbs = { corte_emergencia_bomba_y_llenado: 0.02, reposicion_programada_preventiva: 0.08, volumen_autosuficiente: 0.9 };
    if (nivel < 25) {
      nivelRecarga = 'corte_emergencia_bomba_y_llenado';
      nivelRecProbs = { corte_emergencia_bomba_y_llenado: 0.93, reposicion_programada_preventiva: 0.06, volumen_autosuficiente: 0.01 };
    } else if (nivel < 45) {
      nivelRecarga = 'reposicion_programada_preventiva';
      nivelRecProbs = { corte_emergencia_bomba_y_llenado: 0.08, reposicion_programada_preventiva: 0.84, volumen_autosuficiente: 0.08 };
    }
    answers.nivel_urgencia_recarga = { type: 'choice', choice: nivelRecarga, confidence: (nivelRecProbs as any)[nivelRecarga], probabilities: nivelRecProbs };

    // 5. Electroconductividad (EC) (3 Preguntas)
    // 5.1 Fertilidad nutricional
    let ecFert = 'fertilidad_equilibrada_optima';
    let ecFertProbs = { desnutricion_por_baja_ec: 0.04, fertilidad_equilibrada_optima: 0.92, salinidad_excesiva_estres: 0.04 };
    if (ec < 0.8) {
      ecFert = 'desnutricion_por_baja_ec';
      ecFertProbs = { desnutricion_por_baja_ec: 0.91, fertilidad_equilibrada_optima: 0.07, salinidad_excesiva_estres: 0.02 };
    } else if (ec > 2.2) {
      ecFert = 'salinidad_excesiva_estres';
      ecFertProbs = { desnutricion_por_baja_ec: 0.02, fertilidad_equilibrada_optima: 0.1, salinidad_excesiva_estres: 0.88 };
    }
    answers.ec_fertilidad_solucion_nutritiva = { type: 'choice', choice: ecFert, confidence: (ecFertProbs as any)[ecFert], probabilities: ecFertProbs };

    // 5.2 Presión osmótica raíces
    let ecOsmot = 'gradiente_osmotico_equilibrado';
    let ecOsmProbs = { absorcion_hidrica_fluida: 0.45, gradiente_osmotico_equilibrado: 0.5, plasmolisis_quemadura_radicular: 0.05 };
    if (ec > 2.2) {
      ecOsmot = 'plasmolisis_quemadura_radicular';
      ecOsmProbs = { absorcion_hidrica_fluida: 0.02, gradiente_osmotico_equilibrado: 0.1, plasmolisis_quemadura_radicular: 0.88 };
    } else if (ec <= 1.6) {
      ecOsmot = 'absorcion_hidrica_fluida';
      ecOsmProbs = { absorcion_hidrica_fluida: 0.85, gradiente_osmotico_equilibrado: 0.13, plasmolisis_quemadura_radicular: 0.02 };
    }
    answers.ec_presion_osmotica_raices = { type: 'choice', choice: ecOsmot, confidence: (ecOsmProbs as any)[ecOsmot], probabilities: ecOsmProbs };

    // 5.3 Osmorregulación peces
    let ecPeces = 'osmorregulacion_estable_saludable';
    let ecPecesProbs = { osmorregulacion_estable_saludable: 0.92, osmorregulacion_exigida: 0.06, estres_osmotico_branquial: 0.02 };
    if (ec > 2.4) {
      ecPeces = 'estres_osmotico_branquial';
      ecPecesProbs = { osmorregulacion_estable_saludable: 0.02, osmorregulacion_exigida: 0.13, estres_osmotico_branquial: 0.85 };
    } else if (ec > 1.8) {
      ecPeces = 'osmorregulacion_exigida';
      ecPecesProbs = { osmorregulacion_estable_saludable: 0.12, osmorregulacion_exigida: 0.83, estres_osmotico_branquial: 0.05 };
    }
    answers.ec_osmorregulacion_peces = { type: 'choice', choice: ecPeces, confidence: (ecPecesProbs as any)[ecPeces], probabilities: ecPecesProbs };

    // 6. Turbidez (3 Preguntas)
    // 6.1 Claridad de sólidos
    let turbClaridad = 'agua_cristalina_optima';
    let turbClarProbs = { agua_cristalina_optima: 0.9, turbidez_moderada_aceptable: 0.08, turbidez_critica_exceso_solidos: 0.02 };
    if (turb > 25) {
      turbClaridad = 'turbidez_critica_exceso_solidos';
      turbClarProbs = { agua_cristalina_optima: 0.01, turbidez_moderada_aceptable: 0.08, turbidez_critica_exceso_solidos: 0.91 };
    } else if (turb > 10) {
      turbClaridad = 'turbidez_moderada_aceptable';
      turbClarProbs = { agua_cristalina_optima: 0.1, turbidez_moderada_aceptable: 0.84, turbidez_critica_exceso_solidos: 0.06 };
    }
    answers.turbidez_claridad_solidos = { type: 'choice', choice: turbClaridad, confidence: (turbClarProbs as any)[turbClaridad], probabilities: turbClarProbs };

    // 6.2 Salud branquial
    let turbBranq = 'branquias_limpias_sin_sedimento';
    let turbBranqProbs = { branquias_limpias_sin_sedimento: 0.91, irritacion_branquial_leve: 0.07, oclusion_mecanica_severa: 0.02 };
    if (turb > 25) {
      turbBranq = 'oclusion_mecanica_severa';
      turbBranqProbs = { branquias_limpias_sin_sedimento: 0.01, irritacion_branquial_leve: 0.09, oclusion_mecanica_severa: 0.9 };
    } else if (turb > 12) {
      turbBranq = 'irritacion_branquial_leve';
      turbBranqProbs = { branquias_limpias_sin_sedimento: 0.1, irritacion_branquial_leve: 0.84, oclusion_mecanica_severa: 0.06 };
    }
    answers.turbidez_salud_branquial = { type: 'choice', choice: turbBranq, confidence: (turbBranqProbs as any)[turbBranq], probabilities: turbBranqProbs };

    // 6.3 Filtro mecánico
    let turbFiltro = 'filtro_limpio_flujo_normal';
    let turbFiltProbs = { filtro_limpio_flujo_normal: 0.9, advertencia_limpieza_filtro: 0.08, colmatacion_inminente_requiere_purga: 0.02 };
    if (turb > 25) {
      turbFiltro = 'colmatacion_inminente_requiere_purga';
      turbFiltProbs = { filtro_limpio_flujo_normal: 0.01, advertencia_limpieza_filtro: 0.08, colmatacion_inminente_requiere_purga: 0.91 };
    } else if (turb > 10) {
      turbFiltro = 'advertencia_limpieza_filtro';
      turbFiltProbs = { filtro_limpio_flujo_normal: 0.08, advertencia_limpieza_filtro: 0.86, colmatacion_inminente_requiere_purga: 0.06 };
    }
    answers.turbidez_saturacion_filtro_mecanico = { type: 'choice', choice: turbFiltro, confidence: (turbFiltProbs as any)[turbFiltro], probabilities: turbFiltProbs };

    // 7. Plantas (3 Preguntas)
    // 7.1 Vigor follaje
    let plantVigor = 'follaje_vigoroso_verde_intenso';
    let plantVigProbs = { follaje_vigoroso_verde_intenso: 0.88, clorosis_o_deficiencia_incipiente: 0.08, necrosis_o_marchitamiento_grave: 0.04 };
    if (plantStatus === 'diseased' || ph < 5.3 || (params.plantAvgHealth && params.plantAvgHealth < 0.5)) {
      plantVigor = 'necrosis_o_marchitamiento_grave';
      plantVigProbs = { follaje_vigoroso_verde_intenso: 0.02, clorosis_o_deficiencia_incipiente: 0.11, necrosis_o_marchitamiento_grave: 0.87 };
    } else if (plantStatus === 'stressed' || plantStatus === 'nutrient_deficient' || ph > 7.5 || ec < 0.8) {
      plantVigor = 'clorosis_o_deficiencia_incipiente';
      plantVigProbs = { follaje_vigoroso_verde_intenso: 0.07, clorosis_o_deficiencia_incipiente: 0.85, necrosis_o_marchitamiento_grave: 0.08 };
    }
    answers.plantas_vigor_follaje = { type: 'choice', choice: plantVigor, confidence: (plantVigProbs as any)[plantVigor], probabilities: plantVigProbs };

    // 7.2 Asimilación nutricional
    let plantAsim = 'asimilacion_plena_optima';
    let plantAsimProbs = { asimilacion_plena_optima: 0.86, bloqueo_hierro_por_alcalinidad: 0.05, bloqueo_fosforo_por_acidez: 0.05, inanicion_por_solucion_pobre: 0.04 };
    if (ph > 7.5) {
      plantAsim = 'bloqueo_hierro_por_alcalinidad';
      plantAsimProbs = { asimilacion_plena_optima: 0.03, bloqueo_hierro_por_alcalinidad: 0.89, bloqueo_fosforo_por_acidez: 0.01, inanicion_por_solucion_pobre: 0.07 };
    } else if (ph < 6.0) {
      plantAsim = 'bloqueo_fosforo_por_acidez';
      plantAsimProbs = { asimilacion_plena_optima: 0.02, bloqueo_hierro_por_alcalinidad: 0.01, bloqueo_fosforo_por_acidez: 0.91, inanicion_por_solucion_pobre: 0.06 };
    } else if (ec < 0.8) {
      plantAsim = 'inanicion_por_solucion_pobre';
      plantAsimProbs = { asimilacion_plena_optima: 0.04, bloqueo_hierro_por_alcalinidad: 0.03, bloqueo_fosforo_por_acidez: 0.04, inanicion_por_solucion_pobre: 0.89 };
    }
    answers.plantas_asimilacion_nutricional = { type: 'choice', choice: plantAsim, confidence: (plantAsimProbs as any)[plantAsim], probabilities: plantAsimProbs };

    // 7.3 Integridad radicular
    let plantRaiz = 'raices_blancas_sanas_y_oxigenadas';
    let plantRaizProbs = { raices_blancas_sanas_y_oxigenadas: 0.9, asfixia_radicular_incipiente: 0.07, pudricion_radicular_activa: 0.03 };
    if (temp > 28 && od < 4.0) {
      plantRaiz = 'pudricion_radicular_activa';
      plantRaizProbs = { raices_blancas_sanas_y_oxigenadas: 0.01, asfixia_radicular_incipiente: 0.09, pudricion_radicular_activa: 0.9 };
    } else if (od < 4.8 || turb > 25) {
      plantRaiz = 'asfixia_radicular_incipiente';
      plantRaizProbs = { raices_blancas_sanas_y_oxigenadas: 0.08, asfixia_radicular_incipiente: 0.84, pudricion_radicular_activa: 0.08 };
    }
    answers.plantas_integridad_sistema_radicular = { type: 'choice', choice: plantRaiz, confidence: (plantRaizProbs as any)[plantRaiz], probabilities: plantRaizProbs };

    // 8. Peces (3 Preguntas)
    // 8.1 Patrón natatorio
    let pezNado = 'natacion_activa_homogenea';
    let pezNadoProbs = { natacion_activa_homogenea: 0.91, letargo_fondo_hipotermia: 0.03, aglomeracion_superficie_boqueo: 0.04, nado_erratico_toxicidad: 0.02 };
    if (od < 3.8 || fishStatus === 'surface_crowding') {
      pezNado = 'aglomeracion_superficie_boqueo';
      pezNadoProbs = { natacion_activa_homogenea: 0.01, letargo_fondo_hipotermia: 0.02, aglomeracion_superficie_boqueo: 0.93, nado_erratico_toxicidad: 0.04 };
    } else if (ph > 8.3 || ph < 5.3) {
      pezNado = 'nado_erratico_toxicidad';
      pezNadoProbs = { natacion_activa_homogenea: 0.02, letargo_fondo_hipotermia: 0.03, aglomeracion_superficie_boqueo: 0.06, nado_erratico_toxicidad: 0.89 };
    } else if (temp < 19 || fishStatus === 'stressed') {
      pezNado = 'letargo_fondo_hipotermia';
      pezNadoProbs = { natacion_activa_homogenea: 0.08, letargo_fondo_hipotermia: 0.83, aglomeracion_superficie_boqueo: 0.05, nado_erratico_toxicidad: 0.04 };
    }
    answers.peces_patron_natatorio = { type: 'choice', choice: pezNado, confidence: (pezNadoProbs as any)[pezNado], probabilities: pezNadoProbs };

    // 8.2 Seguridad alimentaria
    let pezComida = 'alimentacion_autorizada_segura';
    let pezComProbs = { alimentacion_autorizada_segura: 0.89, suspension_por_hipoxia_asfixia: 0.04, suspension_por_estres_termico: 0.04, suspension_por_toxicidad_quimica: 0.03 };
    if (od < 4.8 || fishStatus === 'surface_crowding') {
      pezComida = 'suspension_por_hipoxia_asfixia';
      pezComProbs = { alimentacion_autorizada_segura: 0.02, suspension_por_hipoxia_asfixia: 0.91, suspension_por_estres_termico: 0.04, suspension_por_toxicidad_quimica: 0.03 };
    } else if (temp < 18 || temp > 29.5) {
      pezComida = 'suspension_por_estres_termico';
      pezComProbs = { alimentacion_autorizada_segura: 0.04, suspension_por_hipoxia_asfixia: 0.05, suspension_por_estres_termico: 0.87, suspension_por_toxicidad_quimica: 0.04 };
    } else if (ph < 6.2 || ph > 8.0) {
      pezComida = 'suspension_por_toxicidad_quimica';
      pezComProbs = { alimentacion_autorizada_segura: 0.03, suspension_por_hipoxia_asfixia: 0.05, suspension_por_estres_termico: 0.06, suspension_por_toxicidad_quimica: 0.86 };
    }
    answers.peces_seguridad_alimentaria = { type: 'choice', choice: pezComida, confidence: (pezComProbs as any)[pezComida], probabilities: pezComProbs };

    // 8.3 Carga biológica y bienestar
    let pezBienestar = 'bienestar_alto_sin_estres';
    let pezBienProbs = { bienestar_alto_sin_estres: 0.9, estres_fisiologico_moderado: 0.08, riesgo_mortalidad_inminente: 0.02 };
    if (od < 3.2 || ph < 5.4 || ph > 8.4 || temp > 31.5) {
      pezBienestar = 'riesgo_mortalidad_inminente';
      pezBienProbs = { bienestar_alto_sin_estres: 0.01, estres_fisiologico_moderado: 0.07, riesgo_mortalidad_inminente: 0.92 };
    } else if (od < 5.0 || ph < 6.3 || ph > 7.8 || temp > 28.5 || fishStatus === 'stressed') {
      pezBienestar = 'estres_fisiologico_moderado';
      pezBienProbs = { bienestar_alto_sin_estres: 0.08, estres_fisiologico_moderado: 0.85, riesgo_mortalidad_inminente: 0.07 };
    }
    answers.peces_carga_biologica_bienestar = { type: 'choice', choice: pezBienestar, confidence: (pezBienProbs as any)[pezBienestar], probabilities: pezBienProbs };

    // 9. Integración Holística (5 Preguntas)
    // 9.1 Balance ecosistema global
    let sistBalance = 'equilibrio_armonico_perfecto';
    let sistBalProbs = { equilibrio_armonico_perfecto: 0.88, desbalance_compensable: 0.08, descompensacion_sistemica: 0.03, colapso_inminente_multivariable: 0.01 };
    if (od < 3.5 || nivel < 25 || ph < 5.5 || ph > 8.3) {
      sistBalance = 'colapso_inminente_multivariable';
      sistBalProbs = { equilibrio_armonico_perfecto: 0.01, desbalance_compensable: 0.04, descompensacion_sistemica: 0.12, colapso_inminente_multivariable: 0.83 };
    } else if (od < 4.8 || nivel < 38 || ph < 6.3 || ph > 7.8 || temp > 29) {
      sistBalance = 'descompensacion_sistemica';
      sistBalProbs = { equilibrio_armonico_perfecto: 0.04, desbalance_compensable: 0.18, descompensacion_sistemica: 0.73, colapso_inminente_multivariable: 0.05 };
    } else if (ph < 6.5 || ph > 7.4 || temp > 27 || ec < 0.9 || turb > 15) {
      sistBalance = 'desbalance_compensable';
      sistBalProbs = { equilibrio_armonico_perfecto: 0.16, desbalance_compensable: 0.74, descompensacion_sistemica: 0.08, colapso_inminente_multivariable: 0.02 };
    }
    answers.sistema_balance_ecosistema_global = { type: 'choice', choice: sistBalance, confidence: (sistBalProbs as any)[sistBalance], probabilities: sistBalProbs };

    // 9.2 Biofiltro nitrificación integral
    let sistBiofiltro = 'biofiltro_robusto_depuracion_plena';
    let sistBioProbs = { biofiltro_robusto_depuracion_plena: 0.92, biofiltro_estresado_reduccion_eficiencia: 0.06, biofiltro_colapsado_falla_depuracion: 0.02 };
    if (ph < 5.8 || od < 3.2) {
      sistBiofiltro = 'biofiltro_colapsado_falla_depuracion';
      sistBioProbs = { biofiltro_robusto_depuracion_plena: 0.01, biofiltro_estresado_reduccion_eficiencia: 0.09, biofiltro_colapsado_falla_depuracion: 0.9 };
    } else if (ph < 6.4 || ph > 7.9 || od < 4.6 || temp > 29) {
      sistBiofiltro = 'biofiltro_estresado_reduccion_eficiencia';
      sistBioProbs = { biofiltro_robusto_depuracion_plena: 0.08, biofiltro_estresado_reduccion_eficiencia: 0.86, biofiltro_colapsado_falla_depuracion: 0.06 };
    }
    answers.sistema_salud_biofiltro_nitrificacion = { type: 'choice', choice: sistBiofiltro, confidence: (sistBioProbs as any)[sistBiofiltro], probabilities: sistBioProbs };

    // 9.3 Orquestación actuadores
    let sistActuadores = 'operacion_nominal_balanceada';
    let sistActProbs = { operacion_nominal_balanceada: 0.9, prioridad_oxigenacion_emergencia: 0.04, parada_proteccion_bomba: 0.04, protocolo_recuperacion_total: 0.02 };
    if (nivel < 25) {
      sistActuadores = od < 4.5 ? 'protocolo_recuperacion_total' : 'parada_proteccion_bomba';
      sistActProbs = { operacion_nominal_balanceada: 0.01, prioridad_oxigenacion_emergencia: 0.05, parada_proteccion_bomba: 0.88, protocolo_recuperacion_total: 0.06 };
    } else if (od < 4.5 || fishStatus === 'surface_crowding') {
      sistActuadores = 'prioridad_oxigenacion_emergencia';
      sistActProbs = { operacion_nominal_balanceada: 0.01, prioridad_oxigenacion_emergencia: 0.92, parada_proteccion_bomba: 0.02, protocolo_recuperacion_total: 0.05 };
    } else if (ph < 5.5 || ph > 8.3) {
      sistActuadores = 'protocolo_recuperacion_total';
      sistActProbs = { operacion_nominal_balanceada: 0.02, prioridad_oxigenacion_emergencia: 0.08, parada_proteccion_bomba: 0.05, protocolo_recuperacion_total: 0.85 };
    }
    answers.sistema_orquestacion_actuadores = { type: 'choice', choice: sistActuadores, confidence: (sistActProbs as any)[sistActuadores], probabilities: sistActProbs };

    // 9.4 Acción prioritaria
    let sistAccion = 'mantener_rutina_actual';
    let sistAccProbs = { mantener_rutina_actual: 0.88, maximizar_aireacion_inmediata: 0.04, apagar_bomba_y_rellenar_agua: 0.04, suspender_alimentacion_y_revisar_ph: 0.02, purgar_solidos_y_limpiar_filtros: 0.02 };
    if (nivel < 25) {
      sistAccion = 'apagar_bomba_y_rellenar_agua';
      sistAccProbs = { mantener_rutina_actual: 0.01, maximizar_aireacion_inmediata: 0.04, apagar_bomba_y_rellenar_agua: 0.92, suspender_alimentacion_y_revisar_ph: 0.02, purgar_solidos_y_limpiar_filtros: 0.01 };
    } else if (od < 4.5 || fishStatus === 'surface_crowding') {
      sistAccion = 'maximizar_aireacion_inmediata';
      sistAccProbs = { mantener_rutina_actual: 0.01, maximizar_aireacion_inmediata: 0.93, apagar_bomba_y_rellenar_agua: 0.02, suspender_alimentacion_y_revisar_ph: 0.03, purgar_solidos_y_limpiar_filtros: 0.01 };
    } else if (ph < 6.0 || ph > 8.1) {
      sistAccion = 'suspender_alimentacion_y_revisar_ph';
      sistAccProbs = { mantener_rutina_actual: 0.02, maximizar_aireacion_inmediata: 0.06, apagar_bomba_y_rellenar_agua: 0.02, suspender_alimentacion_y_revisar_ph: 0.88, purgar_solidos_y_limpiar_filtros: 0.02 };
    } else if (turb > 25) {
      sistAccion = 'purgar_solidos_y_limpiar_filtros';
      sistAccProbs = { mantener_rutina_actual: 0.04, maximizar_aireacion_inmediata: 0.05, apagar_bomba_y_rellenar_agua: 0.02, suspender_alimentacion_y_revisar_ph: 0.04, purgar_solidos_y_limpiar_filtros: 0.85 };
    }
    answers.sistema_accion_prioritaria = { type: 'choice', choice: sistAccion, confidence: (sistAccProbs as any)[sistAccion], probabilities: sistAccProbs };

    // 9.5 Score de resiliencia global (0 a 4)
    let scoreVal = 4;
    let scoreProbs = [0.01, 0.02, 0.05, 0.15, 0.77];
    if (sistBalance === 'colapso_inminente_multivariable') {
      scoreVal = 0.8;
      scoreProbs = [0.72, 0.2, 0.06, 0.01, 0.01];
    } else if (sistBalance === 'descompensacion_sistemica') {
      scoreVal = 2.0;
      scoreProbs = [0.05, 0.25, 0.55, 0.13, 0.02];
    } else if (sistBalance === 'desbalance_compensable') {
      scoreVal = 3.1;
      scoreProbs = [0.01, 0.05, 0.24, 0.61, 0.09];
    }
    answers.sistema_indice_resiliencia = { type: 'score', score: scoreVal, confidence: 0.9, probabilities: scoreProbs };

    return answers;
  }

  /**
   * Mapea las 29 respuestas de TypeSafe AI en acciones estrictas para los actuadores IoT.
   */
  private async deriveIotDecisions(
    params: TypeSafeEvaluationParams,
    answers: Record<string, any>,
    execute: boolean,
  ): Promise<IotActionDecision[]> {
    const decisions: IotActionDecision[] = [];

    // Estado actual de actuadores
    let currentStatuses: Record<string, boolean> = {};
    try {
      const list = await this.actuators.list();
      for (const a of list) {
        currentStatuses[a.id] = a.on;
      }
    } catch {
      currentStatuses = {
        bomba_agua: true,
        aireador: false,
        dispensador_comida: false,
      };
    }

    // 1. Decisión de Aireador (Basada en OD, patrón natatorio de peces y orquestación)
    const odUrgencia = answers.od_urgencia_aireacion?.choice;
    const odResp = answers.od_estado_respiratorio?.choice;
    const pezNado = answers.peces_patron_natatorio?.choice;
    const orquestacion = answers.sistema_orquestacion_actuadores?.choice;

    const needsAerator =
      odUrgencia === 'aireador_emergencia_maxima' ||
      odUrgencia === 'aireador_activacion_preventiva' ||
      odResp === 'hipoxia_anoxica_letal' ||
      pezNado === 'aglomeracion_superficie_boqueo' ||
      orquestacion === 'prioridad_oxigenacion_emergencia' ||
      orquestacion === 'protocolo_recuperacion_total';

    const isAeratorCritical =
      odUrgencia === 'aireador_emergencia_maxima' ||
      odResp === 'hipoxia_anoxica_letal' ||
      pezNado === 'aglomeracion_superficie_boqueo';

    if (needsAerator) {
      decisions.push({
        actuatorId: 'aireador',
        actuatorLabel: 'Aireador de Oxígeno',
        proposedAction: 'on',
        currentStatus: currentStatuses['aireador'],
        executed: false,
        urgency: isAeratorCritical ? 'critical' : 'high',
        reason: isAeratorCritical
          ? 'Activación de emergencia por hipoxia aguda y boqueo en superficie.'
          : 'Activación preventiva por declive de oxígeno disuelto en agua.',
        biologicalEvidence: `OD: ${params.oxigenoDisuelto.toFixed(1)} mg/L (umbral de normoxia >= 5.0 mg/L). Diagnóstico respiratorio: ${odResp?.replace(/_/g, ' ')}. Probabilidad TypeSafe: ${((answers.od_urgencia_aireacion?.confidence || 0.9) * 100).toFixed(0)}%.`,
      });
    } else {
      decisions.push({
        actuatorId: 'aireador',
        actuatorLabel: 'Aireador de Oxígeno',
        proposedAction: 'off',
        currentStatus: currentStatuses['aireador'],
        executed: false,
        urgency: 'low',
        reason: 'Nivel de oxígeno disuelto óptimo. Mantener apagado para optimizar consumo energético.',
        biologicalEvidence: `OD: ${params.oxigenoDisuelto.toFixed(1)} mg/L. Respiración branquial normal sin riesgo de anoxia.`,
      });
    }

    // 2. Decisión de Bomba de Agua (Basada en nivel de reservorio y seguridad mecánica)
    const nivelSeguridad = answers.nivel_seguridad_bomba?.choice;
    const recargaUrgencia = answers.nivel_urgencia_recarga?.choice;

    if (
      nivelSeguridad === 'peligro_cavitacion_marcha_seco' ||
      recargaUrgencia === 'corte_emergencia_bomba_y_llenado' ||
      params.nivelAgua < 25
    ) {
      decisions.push({
        actuatorId: 'bomba_agua',
        actuatorLabel: 'Bomba de Recirculación',
        proposedAction: 'off',
        currentStatus: currentStatuses['bomba_agua'],
        executed: false,
        urgency: 'critical',
        reason: 'Apagado inmediato para proteger motor por marcha en seco y cavitación (nivel < 25%).',
        biologicalEvidence: `Nivel del reservorio en ${params.nivelAgua.toFixed(0)}% (${((params.nivelAgua / 100) * 32).toFixed(1)} cm) (cota crítica < 25%). Riesgo inminente de destrucción del rodete. Probabilidad TypeSafe: ${((answers.nivel_seguridad_bomba?.confidence || 0.9) * 100).toFixed(0)}%.`,
      });
    } else {
      decisions.push({
        actuatorId: 'bomba_agua',
        actuatorLabel: 'Bomba de Recirculación',
        proposedAction: 'on',
        currentStatus: currentStatuses['bomba_agua'],
        executed: false,
        urgency: 'medium',
        reason: 'Mantener bombeo para asegurar el ciclo hidropónico y la nitrificación del biofiltro.',
        biologicalEvidence: `Nivel de agua seguro: ${params.nivelAgua.toFixed(0)}% (${((params.nivelAgua / 100) * 32).toFixed(1)} cm). Volumen y carga hidrostática suficientes para refrigeración del motor sumergido.`,
      });
    }

    // 3. Decisión de Dispensador de Alimento (Basada en seguridad alimentaria, pH y temperatura)
    const comidaSegura = answers.peces_seguridad_alimentaria?.choice;

    if (comidaSegura === 'alimentacion_autorizada_segura') {
      decisions.push({
        actuatorId: 'dispensador_comida',
        actuatorLabel: 'Dispensador Automático de Alimento',
        proposedAction: 'on',
        currentStatus: currentStatuses['dispensador_comida'],
        executed: false,
        urgency: 'low',
        reason: 'Condiciones metabólicas y fisicoquímicas óptimas para ingesta de ración programada.',
        biologicalEvidence: `OD ${params.oxigenoDisuelto.toFixed(1)} mg/L, Temp ${params.temperaturaAgua.toFixed(1)}°C, pH ${params.ph.toFixed(1)}. Tasa metabólica y apetito óptimos.`,
      });
    } else {
      const whyMap: Record<string, string> = {
        suspension_por_hipoxia_asfixia: `OD insuficiente (${params.oxigenoDisuelto.toFixed(1)} mg/L). La digestión aumentaría la demanda de O2 en un 40% y causaría asfixia.`,
        suspension_por_estres_termico: `Temperatura del agua (${params.temperaturaAgua.toFixed(1)}°C) desestabiliza enzimas digestivas en peces.`,
        suspension_por_toxicidad_quimica: `pH anormal (${params.ph.toFixed(1)}). Alimentar dispararía excreción branquial de amoníaco tóxico (NH3).`,
      };
      decisions.push({
        actuatorId: 'dispensador_comida',
        actuatorLabel: 'Dispensador Automático de Alimento',
        proposedAction: 'off',
        currentStatus: currentStatuses['dispensador_comida'],
        executed: false,
        urgency: 'high',
        reason: 'Bloqueo estricto del dispensador por seguridad biológica del cardumen.',
        biologicalEvidence: whyMap[comidaSegura] || 'Condiciones subóptimas para metabolización de nutrientes.',
      });
    }

    // Si execute === true, aplicamos las decisiones a través de ActuatorService
    if (execute) {
      for (const d of decisions) {
        try {
          const res = await this.actuators.execute(d.actuatorId, d.proposedAction, {
            reason: `[TypeSafe AI decision] ${d.reason}`,
            actor: 'ia',
            bypassMode: true,
          });
          d.executed = true;
          d.executionResult = { ok: res.ok, reason: res.reason };
          this.logger.log(`[IoT Ejecución] ${d.actuatorId} -> ${d.proposedAction.toUpperCase()}: ${res.ok ? 'Éxito' : res.reason}`);
        } catch (err) {
          d.executed = false;
          d.executionResult = { ok: false, reason: (err as Error).message };
          this.logger.error(`Error ejecutando IoT en ${d.actuatorId}: ${(err as Error).message}`);
        }
      }
    }

    return decisions;
  }

  private calculateStabilityScore(
    answers: Record<string, any>,
    params: TypeSafeEvaluationParams,
  ): number {
    // 1. Detección de penalizaciones físicas reales en los sensores
    let penalties = 0;

    // Oxígeno (óptimo >= 5.0)
    if (params.oxigenoDisuelto < 3.2) penalties += 35;
    else if (params.oxigenoDisuelto < 5.0) penalties += 15;

    // Nivel (óptimo >= 40%)
    if (params.nivelAgua < 25) penalties += 35;
    else if (params.nivelAgua < 40) penalties += 15;

    // pH (óptimo 6.5 - 7.5)
    if (params.ph < 5.5 || params.ph > 8.3) penalties += 30;
    else if (params.ph < 6.4 || params.ph > 7.6) penalties += 10;

    // Temperatura (óptimo 20 - 28.5)
    if (params.temperaturaAgua < 18 || params.temperaturaAgua > 31) penalties += 20;
    else if (params.temperaturaAgua < 20 || params.temperaturaAgua > 28.5) penalties += 8;

    // EC (óptimo 0.8 - 2.2)
    if (params.electroconductividad < 0.6 || params.electroconductividad > 2.5) penalties += 15;
    else if (params.electroconductividad < 0.8 || params.electroconductividad > 2.2) penalties += 8;

    // Turbidez (óptimo <= 15)
    if (params.turbidez > 25) penalties += 15;
    else if (params.turbidez > 15) penalties += 8;

    // Estado biológico
    if (params.plantStatus === 'diseased') penalties += 25;
    else if (params.plantStatus === 'stressed' || params.plantStatus === 'nutrient_deficient') penalties += 10;

    if (params.fishStatus === 'surface_crowding') penalties += 30;
    else if (params.fishStatus === 'stressed') penalties += 12;

    const balanceChoice = answers.sistema_balance_ecosistema_global?.choice;
    const rawScore = answers.sistema_indice_resiliencia?.score;

    // 2. Si NO hay penalizaciones reales de parámetros (sistema en equilibrio total):
    if (penalties === 0) {
      if (typeof rawScore === 'number' && rawScore >= 3.0) {
        return Math.min(100, Math.round(92 + (rawScore - 3.0) * 8));
      }
      return 96;
    }

    // 3. Si hay penalizaciones reales, combinamos con el puntaje cualitativo de TypeSafe:
    if (typeof rawScore === 'number') {
      let baseFromTypeSafe = 60;
      if (rawScore >= 3.0) {
        baseFromTypeSafe = 85 + (rawScore - 3.0) * 15;
      } else if (rawScore >= 2.0) {
        baseFromTypeSafe = 60 + (rawScore - 2.0) * 25;
      } else if (rawScore >= 1.0) {
        baseFromTypeSafe = 35 + (rawScore - 1.0) * 25;
      } else {
        baseFromTypeSafe = 10 + rawScore * 25;
      }

      const combined = Math.round(baseFromTypeSafe * 0.5 + (100 - penalties) * 0.5);
      return Math.max(8, Math.min(100, combined));
    }

    return Math.max(8, Math.min(100, 100 - penalties));
  }

  /**
   * Formatea las 29 preguntas con títulos limpios, categorías para filtrado en frontend y explicaciones.
   */
  private formatQuestionsOutput(
    answers: Record<string, any>,
    questionsSchema: Record<string, any>,
  ): Record<string, TypeSafeQuestionOutput> {
    const metaMap: Record<string, { category: string; title: string }> = {
      // pH
      ph_regimen_quimico: { category: 'pH', title: 'Régimen Químico del pH' },
      ph_actividad_bacteriana_nitrificacion: { category: 'pH', title: 'Actividad Nitrificante del Biofiltro' },
      ph_riesgo_amoniaco_toxico: { category: 'pH', title: 'Equilibrio de Toxicidad NH4+ / NH3' },

      // Oxígeno
      od_estado_respiratorio: { category: 'Oxígeno', title: 'Estado Respiratorio Acuático' },
      od_urgencia_aireacion: { category: 'Oxígeno', title: 'Demanda y Urgencia de Aireación' },
      od_respiracion_radicular_biofiltro: { category: 'Oxígeno', title: 'Oxigenación Radicular y Biofiltro' },

      // Temperatura
      temp_confort_metabolico_peces: { category: 'Temperatura', title: 'Confort Metabólico de Peces' },
      temp_solubilidad_oxigeno: { category: 'Temperatura', title: 'Solubilidad Física de Gases' },
      temp_riesgo_patogenos_radiculares: { category: 'Temperatura', title: 'Riesgo de Patógenos Radiculares (Pythium)' },

      // Nivel de Agua
      nivel_seguridad_bomba: { category: 'Nivel de Agua', title: 'Seguridad Mecánica de la Bomba' },
      nivel_estabilidad_hidraulica: { category: 'Nivel de Agua', title: 'Estabilidad y Dinámica Hidráulica' },
      nivel_urgencia_recarga: { category: 'Nivel de Agua', title: 'Urgencia de Reposición de Agua' },

      // Electroconductividad
      ec_fertilidad_solucion_nutritiva: { category: 'EC Nutrientes', title: 'Fertilidad de la Solución Nutritiva' },
      ec_presion_osmotica_raices: { category: 'EC Nutrientes', title: 'Gradiente y Presión Osmótica Radicular' },
      ec_osmorregulacion_peces: { category: 'EC Nutrientes', title: 'Osmorregulación Branquial en Peces' },

      // Turbidez
      turbidez_claridad_solidos: { category: 'Turbidez', title: 'Claridad Óptica y Sólidos en Suspensión' },
      turbidez_salud_branquial: { category: 'Turbidez', title: 'Protección Branquial ante Partículas' },
      turbidez_saturacion_filtro_mecanico: { category: 'Turbidez', title: 'Saturación del Clarificador Mecánico' },

      // Plantas
      plantas_vigor_follaje: { category: 'Plantas', title: 'Vigor Fenológico y Follaje' },
      plantas_asimilacion_nutricional: { category: 'Plantas', title: 'Biodisponibilidad y Asimilación Nutricional' },
      plantas_integridad_sistema_radicular: { category: 'Plantas', title: 'Integridad de la Zona Radicular' },

      // Peces
      peces_patron_natatorio: { category: 'Peces', title: 'Patrón Etológico y Nado del Cardumen' },
      peces_seguridad_alimentaria: { category: 'Peces', title: 'Protocolo de Seguridad Alimentaria' },
      peces_carga_biologica_bienestar: { category: 'Peces', title: 'Índice de Bienestar y Carga Biológica' },

      // Sistema Global
      sistema_balance_ecosistema_global: { category: 'Sistema Global', title: 'Balance Ecosistémico Holístico' },
      sistema_salud_biofiltro_nitrificacion: { category: 'Sistema Global', title: 'Resiliencia Global del Biofiltro' },
      sistema_orquestacion_actuadores: { category: 'Sistema Global', title: 'Estrategia de Coordinación de Actuadores' },
      sistema_accion_prioritaria: { category: 'Sistema Global', title: 'Intervención Física Prioritaria #1' },
      sistema_indice_resiliencia: { category: 'Sistema Global', title: 'Índice Global de Resiliencia (0-4)' },
    };

    const out: Record<string, TypeSafeQuestionOutput> = {};

    for (const [key, q] of Object.entries(answers)) {
      const meta = metaMap[key] || { category: 'General', title: key.replace(/_/g, ' ') };

      if (q.type === 'choice') {
        const expl =
          questionsSchema[key]?.criteria?.[q.choice] ||
          `Opción evaluada: ${q.choice.replace(/_/g, ' ')}`;

        out[key] = {
          category: meta.category,
          parameterKey: key,
          title: meta.title,
          type: 'choice',
          selected: q.choice,
          label: q.choice.replace(/_/g, ' '),
          confidence: Number((q.confidence ?? 0.85).toFixed(2)),
          probabilities: q.probabilities || {},
          explanation: expl,
        };
      } else if (q.type === 'score') {
        out[key] = {
          category: meta.category,
          parameterKey: key,
          title: meta.title,
          type: 'score',
          selected: Number((q.score ?? 3).toFixed(1)),
          confidence: Number((q.confidence ?? 0.9).toFixed(2)),
          probabilities: q.probabilities || [],
          explanation: `Puntuación estimada de resiliencia: ${Number((q.score ?? 3).toFixed(1))} / 4.0`,
        };
      }
    }

    return out;
  }

  private generateExplanations(
    params: TypeSafeEvaluationParams,
    answers: Record<string, any>,
    iotDecisions: IotActionDecision[],
    status: string,
    score: number,
  ): {
    summary: string;
    waterChemistryAnalysis: string;
    iotDecisionRationale: string;
    plantEcosystemStatus: string;
    fishWelfareStatus: string;
    holisticIntegrationAnalysis: string;
    humanActions?: HumanActionProtocol[];
  } {
    const iotSummary = iotDecisions
      .map((d) => `${d.actuatorLabel}: ${d.proposedAction.toUpperCase()} (${d.reason})`)
      .join(' | ');

    const waterSummary = `pH: ${params.ph.toFixed(2)}, OD: ${params.oxigenoDisuelto.toFixed(1)} mg/L, Temp: ${params.temperaturaAgua.toFixed(1)}°C, Nivel: ${params.nivelAgua.toFixed(0)}% (${((params.nivelAgua / 100) * 32).toFixed(1)} cm), EC: ${params.electroconductividad.toFixed(2)} mS/cm, Turb: ${params.turbidez.toFixed(1)} NTU.`;

    const rationale = [
      `1. Aireador: Decisión [${answers.od_urgencia_aireacion?.choice}] por OD=${params.oxigenoDisuelto.toFixed(1)} mg/L y estado [${answers.od_estado_respiratorio?.choice}].`,
      `2. Bomba: Decisión [${answers.nivel_seguridad_bomba?.choice}] con nivel=${params.nivelAgua.toFixed(0)}% (${((params.nivelAgua / 100) * 32).toFixed(1)} cm).`,
      `3. Dispensador: Decisión [${answers.peces_seguridad_alimentaria?.choice}] coordinando O2, pH y temperatura.`,
    ].join(' ');

    const plantExplanation =
      `Vigor foliar: ${answers.plantas_vigor_follaje?.choice?.replace(/_/g, ' ')}. ` +
      `Asimilación: ${answers.plantas_asimilacion_nutricional?.choice?.replace(/_/g, ' ')}. ` +
      (params.ph > 7.5 ? 'Recomendación: acidificar levemente o agregar quelato de hierro DTPA/EDDHA.' : '') +
      (params.ph < 5.8 ? ' Peligro de acidez: dosificar carbonato de potasio o cal apagada.' : '') +
      (params.electroconductividad < 0.8 ? ' Rebalancear biomasa de peces para mayor carga orgánica mineralizable.' : '');

    const fishExplanation =
      `Conducta natatoria: ${answers.peces_patron_natatorio?.choice?.replace(/_/g, ' ')}. ` +
      `Bienestar: ${answers.peces_carga_biologica_bienestar?.choice?.replace(/_/g, ' ')}. ` +
      (params.oxigenoDisuelto < 4.5 ? 'Presentan vulnerabilidad a hipoxia. Se prioriza oxigenación sobre alimentación.' : 'Parámetros respiratorios seguros.');

    const holisticExplanation =
      `Evaluación holística: ${answers.sistema_balance_ecosistema_global?.choice?.replace(/_/g, ' ')}. ` +
      `Biofiltro: ${answers.sistema_salud_biofiltro_nitrificacion?.choice?.replace(/_/g, ' ')}. ` +
      `Intervención prioritaria: ${answers.sistema_accion_prioritaria?.choice?.replace(/_/g, ' ')}.`;

    return {
      summary: `TypeSafe AI evaluó el sistema con un índice de estabilidad del ${score}% (${status.toUpperCase()}). Decisiones IoT: ${iotSummary}`,
      waterChemistryAnalysis: waterSummary,
      iotDecisionRationale: rationale,
      plantEcosystemStatus: plantExplanation,
      fishWelfareStatus: fishExplanation,
      holisticIntegrationAnalysis: holisticExplanation,
    };
  }
}
