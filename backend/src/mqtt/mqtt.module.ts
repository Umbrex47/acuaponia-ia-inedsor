import { Module } from '@nestjs/common';
import { MqttController } from './mqtt.controller';
import { MqttDemoService } from './mqtt-demo.service';
import { MqttService } from './mqtt.service';

@Module({
  controllers: [MqttController],
  providers: [MqttService, MqttDemoService],
  exports: [MqttService],
})
export class MqttModule {}
