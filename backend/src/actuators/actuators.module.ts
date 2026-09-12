import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AlertsModule } from '../alerts/alerts.module';
import { MqttModule } from '../mqtt/mqtt.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActuatorController } from './actuator.controller';
import { ActuatorService } from './actuator.service';
import {
  Actuator,
  ActuatorSchema,
} from './schemas/actuator.schema';
import {
  ActuatorActionLog,
  ActuatorActionSchema,
} from './schemas/actuator-action.schema';

@Module({})
export class ActuatorsModule {
  static forRoot(): DynamicModule {
    const uri = process.env.MONGODB_URI;
    const imports: NonNullable<DynamicModule['imports']> = [
      MqttModule,
      AlertsModule,
      NotificationsModule,
    ];

    if (uri) {
      imports.push(
        MongooseModule.forFeature([
          { name: Actuator.name, schema: ActuatorSchema },
          { name: ActuatorActionLog.name, schema: ActuatorActionSchema },
        ]),
      );
    }

    return {
      module: ActuatorsModule,
      global: true,
      imports,
      controllers: [ActuatorController],
      providers: [ActuatorService],
      exports: [ActuatorService],
    };
  }
}
