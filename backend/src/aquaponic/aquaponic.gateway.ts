import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'ws';
import type { WebSocket } from 'ws';

@WebSocketGateway({ path: '/ws' })
export class AquaponicGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AquaponicGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: WebSocket): void {
    this.logger.debug(`Cliente WebSocket conectado (${this.server.clients.size})`);
    client.send(
      JSON.stringify({
        type: 'welcome',
        message: 'Aquaponic OS backend — listo para telemetría',
      }),
    );
  }

  handleDisconnect(): void {
    this.logger.debug(`Cliente WebSocket desconectado`);
  }

  broadcast(payload: string): void {
    this.server?.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    });
  }
}
