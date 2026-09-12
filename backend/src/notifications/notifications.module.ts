import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlertsModule } from '../alerts/alerts.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import {
  NotificationLog,
  NotificationLogSchema,
} from './schemas/notification-log.schema';
import {
  PushSubscription,
  PushSubscriptionSchema,
} from './schemas/push-subscription.schema';

const uri = process.env.MONGODB_URI;
const dynamicImports: any[] = [MqttModule, forwardRef(() => AlertsModule)];

if (uri) {
  dynamicImports.push(
    MongooseModule.forFeature([
      { name: NotificationLog.name, schema: NotificationLogSchema },
      { name: PushSubscription.name, schema: PushSubscriptionSchema },
    ]),
  );
}

@Module({
  imports: dynamicImports,
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationsModule {}