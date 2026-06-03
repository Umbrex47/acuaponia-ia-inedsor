import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SensorReadingDocument = HydratedDocument<SensorReading>;

/**
 * Un registro histórico de la lectura de un sensor.
 * `timestamps: true` agrega createdAt/updatedAt automáticamente.
 */
@Schema({ timestamps: true, collection: 'sensor_readings' })
export class SensorReading {
  @Prop({ required: true, index: true })
  sensorKey!: string;

  @Prop()
  label!: string;

  @Prop({ required: true })
  value!: number;

  @Prop()
  unit!: string;

  // low | stable | high
  @Prop({ index: true })
  riskLevel!: string;

  @Prop({ default: 'mqtt' })
  source!: string;

  @Prop({ index: true })
  recordedAt!: Date;
}

export const SensorReadingSchema = SchemaFactory.createForClass(SensorReading);

// Índice compuesto para consultar el historial de un sensor por fecha.
SensorReadingSchema.index({ sensorKey: 1, recordedAt: -1 });
