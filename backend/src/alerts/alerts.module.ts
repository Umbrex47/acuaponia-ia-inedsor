import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { AlertsController } from './alerts.controller';
import { AlertService } from './alert.service';
import { MailService } from './mail.service';

@Module({
  imports: [MqttModule],
  controllers: [AlertsController],
  providers: [MailService, AlertService],
  exports: [MailService],
})
export class AlertsModule {}
