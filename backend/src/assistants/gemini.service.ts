import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Mensajes en formato OpenAI-compatible que también encaja con la API de
 * Gemini (los tool_calls se traducen a `functionCall`).
 */
export interface GeminiChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
    /** Firma de pensamiento requerida por modelos Gemini 2.5+/3.x para
     *  mantener continuidad en llamadas a funciones multi-turno. */
    thoughtSignature?: string;
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface GeminiToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface GeminiTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface GeminiChatRequest {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{
    role: 'user' | 'model' | 'function';
    parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }>;
  }>;
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    }>;
  }>;
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
  };
}

export interface GeminiChatResponse {
  candidates: Array<{
    content: {
      role: 'model' | 'user';
      parts: Array<{
        text?: string;
        thoughtSignature?: string;
        functionCall?: { name: string; args: Record<string, unknown>; thoughtSignature?: string };
      }>;
    };
    finishReason: string;
  }>;
}

/**
 * Cliente HTTP para Google Gemini (`/v1beta/models/{model}:generateContent`).
 * Sin SDK externo: usa `fetch` nativo de Node 18+.
 *
 * Interfaz compatible con el `OllamaService` anterior (mismo método `chat`),
 * de modo que `AssistantService` no necesita cambios estructurales.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private apiKey = '';
  private model = 'gemini-2.5-flash';
  private baseUrl = 'https://generativelanguage.googleapis.com';
  private maxOutputTokens = 2048;
  private temperature = 0.2;
  private timeoutMs = 60_000;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('gemini.apiKey', '');
    this.model = this.config.get<string>('gemini.model', this.model);
    this.baseUrl = this.config.get<string>('gemini.baseUrl', this.baseUrl);
    this.maxOutputTokens = this.config.get<number>('gemini.maxOutputTokens', this.maxOutputTokens);
    this.temperature = this.config.get<number>('gemini.temperature', this.temperature);
    this.timeoutMs = this.config.get<number>('gemini.timeoutMs', this.timeoutMs);
  }

  get modelName(): string {
    return this.model;
  }

  /** Devuelve true si la API key está configurada (Gemini no requiere ping). */
  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  /**
   * Mantiene la firma de Ollama: recibe `messages` (formato OpenAI) y
   * opcionalmente `tools`, devuelve un mensaje con `content` y/o `tool_calls`.
   */
  async chat(
    messages: GeminiChatMessage[],
    tools?: GeminiTool[],
  ): Promise<GeminiChatMessage> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const req = this.toGeminiRequest(messages, tools);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = `${this.baseUrl}/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        // Errores frecuentes: 400 API_KEY_INVALID (key con comillas en .env),
        // 404 modelo inexistente/retirado, 429 cuota agotada.
        this.logger.error(`Gemini ${res.status} en modelo "${this.model}": ${text}`);
        throw new Error(`Gemini ${res.status}: ${text}`);
      }
      const data = (await res.json()) as GeminiChatResponse;
      return this.fromGeminiResponse(data);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        this.logger.error(`Gemini timeout tras ${this.timeoutMs}ms`);
        throw new Error(`Gemini no respondió en ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Conversión de mensajes OpenAI → Gemini ────────────────────────────
  private toGeminiRequest(
    messages: GeminiChatMessage[],
    tools?: GeminiTool[],
  ): GeminiChatRequest {
    let systemInstruction: GeminiChatRequest['systemInstruction'];
    const contents: GeminiChatRequest['contents'] = [];

    for (const m of messages) {
      if (m.role === 'system') {
        if (m.content) systemInstruction = { parts: [{ text: m.content }] };
        continue;
      }
      if (m.role === 'user') {
        contents.push({ role: 'user', parts: [{ text: m.content ?? '' }] });
        continue;
      }
      if (m.role === 'assistant') {
        if (m.tool_calls && m.tool_calls.length > 0) {
          contents.push({
            role: 'model',
            parts: m.tool_calls.map((tc) => {
              const part: {
                functionCall: { name: string; args: unknown; thoughtSignature?: string };
              } = {
                functionCall: {
                  name: tc.function.name,
                  args: safeJsonParse(tc.function.arguments),
                },
              };
              // Los modelos thinking de Gemini exigen la firma en el primer
              // functionCall del turno para mantener el hilo de razonamiento.
              if (tc.thoughtSignature) {
                part.functionCall.thoughtSignature = tc.thoughtSignature;
              }
              return part;
            }),
          });
        } else if (m.content) {
          contents.push({ role: 'model', parts: [{ text: m.content }] });
        }
        continue;
      }
      if (m.role === 'tool') {
        contents.push({
          role: 'function',
          parts: [
            {
              functionResponse: {
                name: m.name ?? '',
                response: { content: m.content ?? '' },
              },
            },
          ],
        });
      }
    }

    const req: GeminiChatRequest = {
      contents,
      generationConfig: { maxOutputTokens: this.maxOutputTokens, temperature: this.temperature },
    };
    if (systemInstruction) req.systemInstruction = systemInstruction;
    if (tools && tools.length > 0) {
      req.tools = [
        {
          functionDeclarations: tools.map((t) => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters,
          })),
        },
      ];
    }
    return req;
  }

  // ── Conversión de respuesta Gemini → mensaje OpenAI ──────────────────
  private fromGeminiResponse(data: GeminiChatResponse): GeminiChatMessage {
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const toolCalls: GeminiChatMessage['tool_calls'] = [];
    let text = '';
    let firstFunctionCallSignature: string | undefined;
    for (const p of parts) {
      if (p.text) text += p.text;
      if (p.functionCall) {
        // Gemini adjunta la thoughtSignature solo en el primer functionCall
        // del turno; la conservamos para reenviarla en la siguiente petición.
        const signature = p.functionCall.thoughtSignature ?? p.thoughtSignature;
        const tc: NonNullable<GeminiChatMessage['tool_calls']>[number] = {
          id: `call_${Math.random().toString(36).slice(2, 10)}`,
          type: 'function',
          function: {
            name: p.functionCall.name,
            arguments: JSON.stringify(p.functionCall.args ?? {}),
          },
        };
        if (signature && !firstFunctionCallSignature) {
          tc.thoughtSignature = signature;
          firstFunctionCallSignature = signature;
        }
        toolCalls.push(tc);
      }
    }

    // Los modelos con "thinking" pueden agotar maxOutputTokens razonando y
    // devolver texto vacío o cortado. Avisamos en vez de responder en blanco.
    if (candidate?.finishReason === 'MAX_TOKENS' && toolCalls.length === 0) {
      this.logger.warn(
        `Respuesta truncada por maxOutputTokens=${this.maxOutputTokens}; sube GEMINI_MAX_OUTPUT_TOKENS`,
      );
      if (!text.trim()) {
        text =
          'La respuesta se cortó por el límite de tokens. Aumenta GEMINI_MAX_OUTPUT_TOKENS e inténtalo de nuevo.';
      }
    }

    if (!text.trim() && toolCalls.length === 0) {
      this.logger.warn(
        `Gemini devolvió una respuesta vacía (finishReason=${candidate?.finishReason ?? 'desconocido'})`,
      );
    }

    return {
      role: 'assistant',
      content: text || undefined,
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}