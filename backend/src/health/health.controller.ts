import { Controller, Get } from '@nestjs/common';
import { MqttService } from '../mqtt/mqtt.service';

@Controller()
export class HealthController {
  constructor(private readonly mqtt: MqttService) {}

  @Get()
  root() {
    return {
      name: 'aquaponic-backend',
      status: 'ok',
      websocket: '/ws',
      mqttApi: '/api/mqtt',
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      mqtt: this.mqtt.getConnectionStatus(),
    };
  }
}
