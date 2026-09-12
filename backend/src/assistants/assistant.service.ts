import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActuatorService } from '../actuators/actuator.service';
import { ReadingsService } from '../readings/readings.service';
import { GeminiService, type GeminiChatMessage } from './gemini.service';
import { ChatSession, ChatSessionDocument } from './schemas/chat-session.schema';
import {
  AssistantProposal,
  AssistantProposalDocument,
  ProposalSource,
  ProposalStatus,
} from './schemas/assistant-proposal.schema';
import { z } from 'zod';

const PROPOSE_SCHEMA = z.object({
  id: z.string(),
  actuatorId: z.enum(['bomba_agua', 'aireador', 'dispensador_comida']),
  action: z.enum(['on', 'off', 'dispense']),
  reason: z.string().min(3).max(500),
});

const EXECUTE_SCHEMA = z.object({
  id: z.string(),
  actuatorId: z.enum(['bomba_agua', 'aireador', 'dispensador_comida']),
  action: z.enum(['on', 'off', 'dispense']),
  reason: z.string().min(3).max(500),
});

const SCHEDULE_FEEDER_SCHEMA = z.object({
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)).min(1).max(10),
  durationMs: z.number().int().min(1000).max(120000).optional(),
  portionG: z.number().int().min(1).max(500).optional(),
});

const ACTUATOR_ID_SCHEMA = z.enum(['bomba_agua', 'aireador', 'dispensador_comida']);

const TURN_ON_SCHEMA = z.object({
  actuatorId: ACTUATOR_ID_SCHEMA,
  reason: z.string().min(3).max(500),
});

const TURN_OFF_SCHEMA = z.object({
  actuatorId: ACTUATOR_ID_SCHEMA,
  reason: z.string().min(3).max(500),
});

const DISPENSE_SCHEMA = z.object({
  reason: z.string().min(3).max(500),
  portionG: z.number().int().min(1).max(500).optional(),
});

const SET_MODE_SCHEMA = z.object({
  actuatorId: ACTUATOR_ID_SCHEMA,
  mode: z.enum(['auto', 'manual', 'ia']),
});

const FALLBACK_PROPOSAL_LIMIT = 10;
const FALLBACK_PROPOSAL_MAX_AGE_MS = 600_000;

const SYSTEM_PROMPT = `Eres el Asistente AquaGia, un sistema acuapónico (tilapia + mangle rojo).
Idioma: español. Unidades: métricas. Sé conciso y operativo.

Tu trabajo:
1. Leer el estado actual del sistema (sensores, actuadores, telemetría).
2. Proponer acciones vía tool-calling cuando detectes irregularidades.
3. Solo ejecutar directamente cuando la regla de emergencia lo justifique explícitamente.

Reglas INNEGOCIABLES:
- NUNCA publiques comandos MQTT directamente. Solo usa las herramientas declaradas.
- Para acciones NO urgentes, usa propose_actuator_command (la UI mostrará la propuesta al operador).
- Solo usa execute_actuator_command cuando la acción sea claramente urgente (ej. O₂<3 mg/L, nivel<10 cm).
- Para encender/apagar/dispensar de forma explícita y razonada usa turn_actuator_on / turn_actuator_off / dispense_food (siempre con motivo y evidencia).
- Para cambiar el modo de operación usa set_actuator_mode (auto / manual / ia).
- Si el actuador está en modo "manual", NO ejecutes; solo propón.
- Indica la evidencia (lectura concreta) en cada propuesta.
- Si reprogramas el feeder, el operador debe ver los horarios antes de que se ejecuten.
- No inventes datos: si no sabes, lee con get_current_state.
- Prefiere una propuesta a una ejecución innecesaria.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_current_state',
      description: 'Devuelve el estado actual de sensores y última telemetría de peces/plantas.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_actuator_status',
      description: 'Devuelve el estado de un actuador (bomba_agua, aireador, dispensador_comida).',
      parameters: {
        type: 'object',
        properties: {
          actuatorId: {
            type: 'string',
            enum: ['bomba_agua', 'aireador', 'dispensador_comida'],
          },
        },
        required: ['actuatorId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_actuator_command',
      description: 'Propone una acción sobre un actuador. La UI mostrará la propuesta al operador para que la apruebe o rechace.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Identificador único de la propuesta' },
          actuatorId: {
            type: 'string',
            enum: ['bomba_agua', 'aireador', 'dispensador_comida'],
          },
          action: { type: 'string', enum: ['on', 'off', 'dispense'] },
          reason: { type: 'string', description: 'Motivo legible y breve con evidencia' },
        },
        required: ['id', 'actuatorId', 'action', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_actuator_command',
      description: 'Ejecuta una acción directamente. SOLO usar en emergencias justificadas (O₂ crítico, nivel mínimo, etc.)',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          actuatorId: { type: 'string', enum: ['bomba_agua', 'aireador', 'dispensador_comida'] },
          action: { type: 'string', enum: ['on', 'off', 'dispense'] },
          reason: { type: 'string' },
        },
        required: ['id', 'actuatorId', 'action', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_history',
      description: 'Devuelve un resumen de las últimas acciones registradas.',
      parameters: {
        type: 'object',
        properties: { minutes: { type: 'number', minimum: 1, maximum: 1440 } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'schedule_feeder',
      description: 'Reprograma los horarios del dispensador de comida.',
      parameters: {
        type: 'object',
        properties: {
          times: {
            type: 'array',
            items: { type: 'string', pattern: '^([01]\\d|2[0-3]):([0-5]\\d)$' },
          },
          durationMs: { type: 'number', minimum: 1000, maximum: 120000 },
          portionG: { type: 'number', minimum: 1, maximum: 500 },
        },
        required: ['times'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'turn_actuator_on',
      description:
        'Enciende explícitamente un actuador (bomba_agua, aireador o dispensador_comida). ' +
        'Úsalo cuando sepas exactamente por qué quieres encenderlo. ' +
        'Para acciones no urgentes prefiere propose_actuator_command.',
      parameters: {
        type: 'object',
        properties: {
          actuatorId: {
            type: 'string',
            enum: ['bomba_agua', 'aireador', 'dispensador_comida'],
          },
          reason: {
            type: 'string',
            description: 'Motivo legible y breve con evidencia (lectura del sensor, hora, etc.)',
          },
        },
        required: ['actuatorId', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'turn_actuator_off',
      description:
        'Apaga explícitamente un actuador (bomba_agua, aireador o dispensador_comida). ' +
        'Úsalo cuando detectes un problema o cuando la condición que lo encendió ya pasó.',
      parameters: {
        type: 'object',
        properties: {
          actuatorId: {
            type: 'string',
            enum: ['bomba_agua', 'aireador', 'dispensador_comida'],
          },
          reason: {
            type: 'string',
            description: 'Motivo legible y breve con evidencia',
          },
        },
        required: ['actuatorId', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'dispense_food',
      description:
        'Dispensar una ración de comida ahora mismo, sin cambiar el horario programado. ' +
        'Equivale a pulsar el botón "dispensar" del panel.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Motivo legible y breve',
          },
          portionG: {
            type: 'number',
            minimum: 1,
            maximum: 500,
            description: 'Tamaño de la ración en gramos (opcional)',
          },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_actuator_mode',
      description:
        'Cambia el modo de operación de un actuador: ' +
        '"ia" (la IA puede proponer/ejecutar), "auto" (solo reglas automáticas), ' +
        '"manual" (solo el operador; la IA solo propone).',
      parameters: {
        type: 'object',
        properties: {
          actuatorId: {
            type: 'string',
            enum: ['bomba_agua', 'aireador', 'dispensador_comida'],
          },
          mode: {
            type: 'string',
            enum: ['auto', 'manual', 'ia'],
          },
        },
        required: ['actuatorId', 'mode'],
      },
    },
  },
];

export interface ChatTurnResult {
  reply: string;
  toolCalls: Array<{ name: string; ok: boolean; summary: string }>;
  proposals: Array<{ id: string; actuatorId: string; action: string; reason: string }>;
}

@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);
  private enabled = true;
  private sessionTtlMs = 1_800_000;
  private customPrompt = '';

  constructor(
    private readonly gemini: GeminiService,
    private readonly actuators: ActuatorService,
    private readonly readings: ReadingsService,
    private readonly config: ConfigService,
    @Optional()
    @InjectModel(ChatSession.name)
    private readonly chatModel?: Model<ChatSessionDocument>,
    @Optional()
    @InjectModel(AssistantProposal.name)
    private readonly proposalModel?: Model<AssistantProposalDocument>,
  ) {}

  onModuleInit(): void {
    this.enabled = this.config.get<boolean>('assistant.enabled', true);
    this.sessionTtlMs = this.config.get<number>('assistant.sessionTtlMs', 1_800_000);
    this.customPrompt = this.config.get<string>('assistant.systemPrompt', '');

    if (!this.enabled) {
      this.logger.warn('Assistente deshabilitado');
      return;
    }

    this.gemini.isAvailable().then((ok) => {
      if (ok) {
        this.logger.log(`Gemini listo (${this.gemini.modelName})`);
      } else {
        this.logger.warn('GEMINI_API_KEY no configurada — asistente sin LLM');
      }
    });
  }

  /** Historial de mensajes de una sesión. */
  async getHistory(clientId: string): Promise<ChatSession['messages']> {
    if (!this.chatModel) return [];
    const session = await this.chatModel.findOne({ clientId }).lean();
    if (!session) return [];
    return session.messages ?? [];
  }

  async listProposals(): Promise<AssistantProposal[]> {
    if (!this.proposalModel) return [];
    return this.proposalModel.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(FALLBACK_PROPOSAL_LIMIT).lean();
  }

  async resolveProposal(
    proposalId: string,
    decision: 'approved' | 'rejected',
    decidedBy: string,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!this.proposalModel) return { ok: false, reason: 'MongoDB no configurado' };
    const proposal = await this.proposalModel.findOne({ id: proposalId, status: 'pending' }).lean();
    if (!proposal) return { ok: false, reason: 'Propuesta no encontrada o ya resuelta' };

    await this.proposalModel.updateOne(
      { id: proposalId },
      { $set: { status: decision, decidedBy, decidedAt: new Date() } },
    );

    if (decision === 'approved') {
      const result = await this.actuators.execute(proposal.actuatorId, proposal.action as 'on' | 'off' | 'dispense', {
        reason: `[aprobada por ${decidedBy}] ${proposal.reason}`,
        actor: 'user',
      });
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    }
    return { ok: true };
  }

  /** Ejecuta un turno completo de chat: prompt + tool-calls + respuesta final. */
  async chat(clientId: string, userMessage: string): Promise<ChatTurnResult> {
    if (!this.enabled) {
      return { reply: 'El asistente está deshabilitado.', toolCalls: [], proposals: [] };
    }

    const history = await this.getHistory(clientId);
    const systemMsg = this.buildSystemPrompt();

    const messages: GeminiChatMessage[] = [
      { role: 'system', content: systemMsg },
      ...history.map((m) => ({
        role: m.role,
        content: m.content,
        tool_call_id: m.tool_call_id,
        name: m.name,
        tool_calls: m.tool_calls,
      })),
      { role: 'user', content: userMessage },
    ];

    const toolCalls: ChatTurnResult['toolCalls'] = [];
    const proposals: ChatTurnResult['proposals'] = [];

    // Hasta 3 rounds de tool-calls.
    for (let round = 0; round < 3; round += 1) {
      const reply = await this.gemini.chat(messages as never, TOOLS as never);
      if (reply.tool_calls && reply.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: reply.content ?? '',
          tool_calls: reply.tool_calls,
        });

        for (const tc of reply.tool_calls) {
          let args: unknown = {};
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            args = {};
          }

          const toolResult = await this.invokeTool(tc.function.name, args, 'ia', proposals);
          toolCalls.push({ name: tc.function.name, ok: toolResult.ok, summary: toolResult.summary });

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: toolResult.summary,
          });
        }
        continue;
      }
      messages.push({ role: 'assistant', content: reply.content ?? '' });
      await this.persist(clientId, messages.slice(1) as ChatSession['messages']); // sin system
      return { reply: reply.content ?? '', toolCalls, proposals };
    }

    // Si agotamos los rounds, devolvemos lo último.
    const final = messages[messages.length - 1];
    await this.persist(clientId, messages.slice(1) as ChatSession['messages']);
    return { reply: typeof final.content === 'string' ? final.content : '', toolCalls, proposals };
  }

  private async persist(clientId: string, messages: ChatSession['messages']): Promise<void> {
    if (!this.chatModel) return;
    try {
      const slim = messages.map((m) => ({
        role: m.role,
        content: m.content ?? '',
        tool_calls: m.tool_calls,
        tool_call_id: m.tool_call_id,
        name: m.name,
        ts: new Date().toISOString(),
      }));
      await this.chatModel.updateOne(
        { clientId },
        { $set: { messages: slim, lastActiveAt: new Date() } },
        { upsert: true },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`No se pudo persistir la sesión: ${msg}`);
    }
  }

  private async invokeTool(
    name: string,
    args: unknown,
    source: ProposalSource,
    proposals: ChatTurnResult['proposals'],
  ): Promise<{ ok: boolean; summary: string }> {
    switch (name) {
      case 'get_current_state': {
        const latest = await this.readings.findLatestBySensor();
        return {
          ok: true,
          summary: JSON.stringify(latest.slice(0, 20)),
        };
      }
      case 'get_actuator_status': {
        const parsed = z.object({ actuatorId: z.string() }).safeParse(args);
        if (!parsed.success) return { ok: false, summary: 'actuatorId requerido' };
        const status = await this.actuators.getStatus(parsed.data.actuatorId);
        return { ok: Boolean(status), summary: JSON.stringify(status) };
      }
      case 'propose_actuator_command': {
        const parsed = PROPOSE_SCHEMA.safeParse(args);
        if (!parsed.success) {
          return { ok: false, summary: `Propuesta inválida: ${parsed.error.message}` };
        }
        const data = parsed.data;
        const proposal = await this.createProposal(data.id, data.actuatorId, data.action, data.reason, source);
        if (proposal.ok) {
          proposals.push({ id: data.id, actuatorId: data.actuatorId, action: data.action, reason: data.reason });
        }
        return { ok: proposal.ok, summary: proposal.reason ?? 'Propuesta registrada' };
      }
      case 'execute_actuator_command': {
        const parsed = EXECUTE_SCHEMA.safeParse(args);
        if (!parsed.success) {
          return { ok: false, summary: `Ejecución inválida: ${parsed.error.message}` };
        }
        const data = parsed.data;
        const result = await this.actuators.execute(data.actuatorId, data.action, {
          reason: `[emergencia-IA] ${data.reason}`,
          actor: 'ia',
        });
        return { ok: result.ok, summary: result.reason ?? (result.ok ? 'Ejecutado' : 'Error') };
      }
      case 'get_recent_history': {
        const parsed = z.object({ minutes: z.number().optional() }).safeParse(args);
        const minutes = parsed.success && parsed.data.minutes ? parsed.data.minutes : 60;
        return {
          ok: true,
          summary: `Últimas ${minutes} min no disponibles (módulo desactivado).`,
        };
      }
      case 'schedule_feeder': {
        const parsed = SCHEDULE_FEEDER_SCHEMA.safeParse(args);
        if (!parsed.success) {
          return { ok: false, summary: `Horarios inválidos: ${parsed.error.message}` };
        }
        proposals.push({
          id: 'feeder-' + Date.now(),
          actuatorId: 'dispensador_comida',
          action: 'schedule',
          reason: `Reprogramar feeder: ${parsed.data.times.join(', ')}`,
        });
        return { ok: true, summary: 'Propuesta de reprogramación enviada al operador.' };
      }
      case 'turn_actuator_on': {
        const parsed = TURN_ON_SCHEMA.safeParse(args);
        if (!parsed.success) {
          return { ok: false, summary: `Argumentos inválidos: ${parsed.error.message}` };
        }
        const result = await this.actuators.execute(parsed.data.actuatorId, 'on', {
          reason: `[IA-on] ${parsed.data.reason}`,
          actor: 'ia',
        });
        return {
          ok: result.ok,
          summary: result.ok
            ? `${parsed.data.actuatorId} encendido.`
            : result.reason ?? 'No se pudo encender',
        };
      }
      case 'turn_actuator_off': {
        const parsed = TURN_OFF_SCHEMA.safeParse(args);
        if (!parsed.success) {
          return { ok: false, summary: `Argumentos inválidos: ${parsed.error.message}` };
        }
        const result = await this.actuators.execute(parsed.data.actuatorId, 'off', {
          reason: `[IA-off] ${parsed.data.reason}`,
          actor: 'ia',
        });
        return {
          ok: result.ok,
          summary: result.ok
            ? `${parsed.data.actuatorId} apagado.`
            : result.reason ?? 'No se pudo apagar',
        };
      }
      case 'dispense_food': {
        const parsed = DISPENSE_SCHEMA.safeParse(args);
        if (!parsed.success) {
          return { ok: false, summary: `Argumentos inválidos: ${parsed.error.message}` };
        }
        const result = await this.actuators.execute('dispensador_comida', 'dispense', {
          reason: `[IA-dispense] ${parsed.data.reason}${parsed.data.portionG ? ` (${parsed.data.portionG}g)` : ''}`,
          actor: 'ia',
        });
        return {
          ok: result.ok,
          summary: result.ok
            ? `Comida dispensada${parsed.data.portionG ? ` (${parsed.data.portionG}g)` : ''}.`
            : result.reason ?? 'No se pudo dispensar',
        };
      }
      case 'set_actuator_mode': {
        const parsed = SET_MODE_SCHEMA.safeParse(args);
        if (!parsed.success) {
          return { ok: false, summary: `Argumentos inválidos: ${parsed.error.message}` };
        }
        const status = await this.actuators.setMode(parsed.data.actuatorId, parsed.data.mode);
        if (!status) {
          return { ok: false, summary: `Actuador no encontrado: ${parsed.data.actuatorId}` };
        }
        return {
          ok: true,
          summary: `Modo de ${parsed.data.actuatorId} → ${parsed.data.mode}.`,
        };
      }
      default:
        return { ok: false, summary: `Herramienta desconocida: ${name}` };
    }
  }

  private async createProposal(
    id: string,
    actuatorId: string,
    action: string,
    reason: string,
    source: ProposalSource,
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!this.proposalModel) return { ok: false, reason: 'MongoDB no configurado' };
    const status: ProposalStatus = 'pending';
    await this.proposalModel.updateOne(
      { id },
      {
        $set: {
          id,
          actuatorId,
          action,
          reason,
          source,
          status,
          expiresAt: new Date(Date.now() + FALLBACK_PROPOSAL_MAX_AGE_MS),
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { ok: true };
  }

  private buildSystemPrompt(): string {
    const base = this.customPrompt || SYSTEM_PROMPT;
    const recommended = this.config.get<string>('feeder.times', '08:00,12:00,17:00');
    return `${base}\n\nHorarios actuales del dispensador: ${recommended}.`;
  }
}
