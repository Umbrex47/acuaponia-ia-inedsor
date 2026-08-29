import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'ws';
import type { WebSocket } from 'ws';
import { AssistantService } from './assistant.service';
import { Subject } from 'rxjs';

interface IncomingMessage {
  type: 'chat' | 'reset';
  clientId?: string;
  message?: string;
}

@Injectable()
@WebSocketGateway({ path: '/chat' })
export class AssistantGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AssistantGateway.name);

  @WebSocketServer()
  server!: Server;

  messages$ = new Subject<{ type: 'proposal' | 'resolved'; payload: unknown }>();

  constructor(private readonly assistant: AssistantService) {}

  handleConnection(client: WebSocket): void {
    this.logger.debug(`Cliente ChatWS conectado (${this.server.clients.size})`);
    client.send(
      JSON.stringify({ type: 'welcome', message: 'Asistente AquaGia listo' }),
    );
    client.on('message', (data) => {
      void this.handleMessage(client, data.toString());
    });
  }

  handleDisconnect(): void {
    this.logger.debug('Cliente ChatWS desconectado');
  }

  async handleMessage(client: WebSocket, raw: string): Promise<void> {
    let msg: IncomingMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return this.sendError(client, 'JSON inválido');
    }

    if (msg.type === 'reset') {
      const clientId = msg.clientId ?? randomUUID();
      client.send(JSON.stringify({ type: 'reset', clientId }));
      return;
    }

    if (msg.type === 'chat') {
      const clientId = msg.clientId ?? randomUUID();
      const text = (msg.message ?? '').trim();
      if (!text) return this.sendError(client, 'Mensaje vacío');

      client.send(JSON.stringify({ type: 'ack', clientId, message: text }));

      // Sin try/catch un fallo de Gemini dejaba la promesa rechazada y el
      // cliente esperando para siempre: hay que responder con `error`.
      try {
        const result = await this.assistant.chat(clientId, text);
        client.send(
          JSON.stringify({
            type: 'reply',
            clientId,
            reply: result.reply,
            toolCalls: result.toolCalls,
            proposals: result.proposals,
          }),
        );

        for (const p of result.proposals) {
          this.messages$.next({ type: 'proposal', payload: p });
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        this.logger.error(`Fallo al procesar chat: ${detail}`);
        this.sendError(client, `El asistente falló: ${detail}`);
      }
    }
  }

  private sendError(client: WebSocket, reason: string): void {
    try {
      client.send(JSON.stringify({ type: 'error', reason }));
    } catch {
      /* ignore */
    }
  }
}
