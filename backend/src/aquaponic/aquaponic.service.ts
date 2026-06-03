import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AquaponicGateway } from './aquaponic.gateway';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class AquaponicService implements OnModuleInit {
  private readonly logger = new Logger(AquaponicService.name);

  constructor(
    private readonly mqtt: MqttService,
    private readonly gateway: AquaponicGateway,
  ) {}

  onModuleInit(): void {
    this.mqtt.messages$.subscribe(({ topic, payload }) => {
      const forwarded = this.normalizeForDashboard(topic, payload);
      if (!forwarded) return;

      this.gateway.broadcast(forwarded);
    });

    this.mqtt.status$.subscribe((status) => {
      this.gateway.broadcast(
        JSON.stringify({ type: 'mqtt_status', ...status }),
      );
    });
  }

  /**
   * Reenvía el payload tal cual si es JSON válido; si no, lo envuelve.
   */
  private normalizeForDashboard(topic: string, raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      JSON.parse(trimmed);
      return trimmed;
    } catch {
      this.logger.warn(`Payload no JSON en ${topic}; se omite`);
      return null;
    }
  }
}
