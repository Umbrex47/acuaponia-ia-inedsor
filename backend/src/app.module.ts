// Carga .env antes de evaluar la metadata del módulo, para que
// ReadingsModule.forRoot() pueda leer MONGODB_URI en tiempo de import.
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { HealthController } from './health/health.controller';
import { MqttModule } from './mqtt/mqtt.module';
import { AquaponicModule } from './aquaponic/aquaponic.module';
import { AlertsModule } from './alerts/alerts.module';
import { ReadingsModule } from './readings/readings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    MqttModule,
    AquaponicModule,
    AlertsModule,
    ReadingsModule.forRoot(),
  ],
  controllers: [HealthController],
})
export class AppModule {}
