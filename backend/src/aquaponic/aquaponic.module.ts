import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { AquaponicGateway } from './aquaponic.gateway';
import { AquaponicService } from './aquaponic.service';
import { DemoTelemetryService } from './demo-telemetry.service';

@Module({
  imports: [MqttModule],
  providers: [AquaponicGateway, AquaponicService, DemoTelemetryService],
})
export class AquaponicModule {}
