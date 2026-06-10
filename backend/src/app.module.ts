// Carga .env antes de evaluar la metadata del módulo, para que
// ReadingsModule.forRoot() pueda leer MONGODB_URI en tiempo de import.
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { MqttModule } from './mqtt/mqtt.module';
import { AquaponicModule } from './aquaponic/aquaponic.module';
import { AlertsModule } from './alerts/alerts.module';
import { ReadingsModule } from './readings/readings.module';
import { DecisionModule } from './decision/decision.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    MqttModule,
    AquaponicModule,
    AlertsModule,
    ReadingsModule.forRoot(),
    DecisionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
