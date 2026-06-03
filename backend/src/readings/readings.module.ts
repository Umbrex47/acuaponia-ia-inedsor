import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MqttModule } from '../mqtt/mqtt.module';
import { ReadingsController } from './readings.controller';
import { ReadingsService } from './readings.service';
import {
  SensorReading,
  SensorReadingSchema,
} from './schemas/sensor-reading.schema';

@Module({})
export class ReadingsModule {
  /**
   * Registra el módulo. La conexión a MongoDB solo se monta si MONGODB_URI
   * está presente; así la app sigue funcionando sin base de datos.
   */
  static forRoot(): DynamicModule {
    const uri = process.env.MONGODB_URI;
    const imports: NonNullable<DynamicModule['imports']> = [MqttModule];

    if (uri) {
      imports.push(
        MongooseModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            uri: config.get<string>('mongodb.uri'),
            dbName: config.get<string>('mongodb.dbName') || undefined,
          }),
        }),
        MongooseModule.forFeature([
          { name: SensorReading.name, schema: SensorReadingSchema },
        ]),
      );
    } else {
      new Logger(ReadingsModule.name).warn(
        'MONGODB_URI no definido — el módulo de registro arranca sin conexión',
      );
    }

    return {
      module: ReadingsModule,
      imports,
      controllers: [ReadingsController],
      providers: [ReadingsService],
      exports: [ReadingsService],
    };
  }
}
