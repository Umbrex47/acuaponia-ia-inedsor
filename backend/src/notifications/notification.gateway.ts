import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'ws';
import type { WebSocket } from 'ws';
import { NotificationRecord } from './notification.service';

/**
 * Gateway WebSocket que reusa el path `/ws` existente (donde `AquaponicGateway`
 * ya publica telemetría). Los clientes reciben además mensajes `notification`
 * con `{ type: 'notification', payload: NotificationRecord }`.
 *
 * Mantener un solo path simplifica el cliente: useWebSocket ya existente
 * puede enrutar por `data.type` para distinguir telemetría vs notificación.
 */
@Injectable()
@WebSocketGateway({ path: '/ws' })
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(NotificationGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.logger.log('NotificationGateway listo en /ws');
  }

  handleConnection(client: WebSocket): void {
    this.logger.debug(`Cliente WS conectado (${this.server.clients.size})`);
  }

  handleDisconnect(): void {
    this.logger.debug('Cliente WS desconectado');
  }

  broadcastNotification(record: NotificationRecord): void {
    if (!this.server) return;
    const payload = JSON.stringify({ type: 'notification', payload: record });
    this.server.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    });
  }
}