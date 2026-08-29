import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { DebugController } from './debug.controller';
import { DebugService } from './debug.service';

@Module({
  imports: [MqttModule],
  controllers: [DebugController],
  providers: [DebugService],
})
export class DebugModule {}