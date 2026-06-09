import { Module } from '@nestjs/common';
import { MqttModule } from '../mqtt/mqtt.module';
import { AlertsController } from './alerts.controller';
import { AlertService } from './alert.service';
import { MailService } from './mail.service';
import { TelegramService } from './telegram.service';

@Module({
  imports: [MqttModule],
  controllers: [AlertsController],
  providers: [MailService, TelegramService, AlertService],
  exports: [MailService, TelegramService],
})
export class AlertsModule {}
