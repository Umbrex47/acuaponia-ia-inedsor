import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

export interface OllamaToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaChatMessage[];
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  options?: {
    num_ctx?: number;
    num_predict?: number;
    temperature?: number;
  };
  stream?: boolean;
}

export interface OllamaChatResponse {
  message: OllamaChatMessage;
  done: boolean;
  error?: string;
}

/**
 * Cliente HTTP para Ollama (`/api/chat`).
 * No añade dependencias: usa `fetch` nativo de Node 18+.
 */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private url = 'http://localhost:11434';
  private model = 'llama3.1:8b-q4_0';
  private numCtx = 2048;
  private numPredict = 256;
  private temperature = 0.2;
  private timeoutMs = 60_000;

  constructor(private readonly config: ConfigService) {
    this.url = this.config.get<string>('ollama.url', this.url);
    this.model = this.config.get<string>('ollama.model', this.model);
    this.numCtx = this.config.get<number>('ollama.numCtx', this.numCtx);
    this.numPredict = this.config.get<number>('ollama.numPredict', this.numPredict);
    this.temperature = this.config.get<number>('ollama.temperature', this.temperature);
    this.timeoutMs = this.config.get<number>('ollama.timeoutMs', this.timeoutMs);
  }

  get modelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.fetchWithTimeout(`${this.url}/api/tags`, {
        method: 'GET',
      }, 3000);
      return res.ok;
    } catch {
      return false;
    }
  }

  async chat(messages: OllamaChatMessage[], tools?: OllamaChatRequest['tools']): Promise<OllamaChatMessage> {
    const body: OllamaChatRequest = {
      model: this.model,
      messages,
      tools,
      options: {
        num_ctx: this.numCtx,
        num_predict: this.numPredict,
        temperature: this.temperature,
      },
      stream: false,
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.url}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama ${res.status}: ${text}`);
      }
      const data = (await res.json()) as OllamaChatResponse;
      return data.message;
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}
