import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type ManualReadingDocument = HydratedDocument<ManualReading>;

export class FishObservation {
  @Prop({ default: 0 })
  mortalityCount!: number;

  @Prop({ default: '' })
  behaviorNotes!: string;

  @Prop()
  averageWeightGrams?: number;

  @Prop()
  feedAmountGrams?: number;

  // excelente | bueno | regular | critico
  @Prop({ default: 'bueno' })
  generalHealth!: string;
}

export interface ParameterEvaluation {
  value: number;
  label: string;
  unit: string;
  riskLevel: 'low' | 'stable' | 'high';
}

/**
 * Registro de auditoría y muestreo manual de variables de calidad de agua y peces.
 * Permite registrar quién realizó la medición, a qué hora y fecha, los valores obtenidos
 * (nitratos, nitritos, amonio, ph, etc.) y observaciones de peces.
 */
@Schema({ timestamps: true, collection: 'manual_readings' })
export class ManualReading {
  /** Nombre o identificador del operador o técnico que realizó el muestreo. */
  @Prop({ required: true, index: true })
  operator!: string;

  /** Rol del operador (ej. Técnico Acuícola, Investigador, Supervisor). */
  @Prop({ default: 'Operador' })
  operatorRole!: string;

  /** Fecha y hora exacta en la que se tomó la muestra física en campo/laboratorio. */
  @Prop({ required: true, index: true })
  timestamp!: Date;

  /** Fecha y hora en la que se guardó en el sistema. */
  @Prop({ default: () => new Date() })
  recordedAt!: Date;

  /** Mapa de variables medidas (clave del sensor -> valor numérico). */
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  values!: Record<string, number>;

  /** Evaluación del riesgo calculada automáticamente al momento del registro. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  evaluations!: Record<string, ParameterEvaluation>;

  /** Notas u observaciones generales sobre el muestreo. */
  @Prop({ default: '' })
  notes!: string;

  /** Observaciones directas sobre los peces en el tanque. */
  @Prop({ type: FishObservation, default: () => ({}) })
  fishObservation?: FishObservation;

  /** Origen del registro (mobile-app | web-dashboard | script). */
  @Prop({ default: 'mobile-app' })
  source!: string;
}

export const ManualReadingSchema = SchemaFactory.createForClass(ManualReading);

ManualReadingSchema.index({ timestamp: -1 });
ManualReadingSchema.index({ operator: 1, timestamp: -1 });
