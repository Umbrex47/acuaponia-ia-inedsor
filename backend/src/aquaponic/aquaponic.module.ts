import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { AquaponicGateway } from './aquaponic.gateway';
import { AquaponicService } from './aquaponic.service';
import { DemoController } from './demo.controller';
import { DemoTelemetryService } from './demo-telemetry.service';

@Module({
  imports: [MqttModule],
  controllers: [DemoController],
  providers: [AquaponicGateway, AquaponicService, DemoTelemetryService],
  exports: [DemoTelemetryService],
})
export class AquaponicModule {}
