import { Module, forwardRef } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  imports: [MqttModule, forwardRef(() => AlertsModule)],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationsModule {}