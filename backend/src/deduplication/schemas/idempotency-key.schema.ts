import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type IdempotencyKeyDocument = HydratedDocument<IdempotencyKey>;

/**
 * Registro de deduplicación idempotente estilo MQTT QoS 2.
 * Permite garantizar la entrega "exactamente una vez" (Exactly-Once).
 * Si el cliente móvil reenvía un mensaje tras perder conexión temporalmente,
 * el servidor detecta que la clave ya existe y devuelve la misma respuesta
 * sin reinsertar duplicados en la base de datos.
 */
@Schema({ timestamps: true, collection: 'idempotency_keys' })
export class IdempotencyKey {
  /** Identificador único global generado por el cliente móvil (UUID o MessageId). */
  @Prop({ required: true, unique: true, index: true })
  key!: string;

  /** Endpoint o acción (ej: "POST /readings/manual"). */
  @Prop({ required: true, index: true })
  endpoint!: string;

  /** Nivel de QoS utilizado (1 o 2). */
  @Prop({ default: 2 })
  qos!: number;

  /** Código de estado HTTP de la respuesta original (ej: 200, 201). */
  @Prop({ default: 200 })
  responseStatus!: number;

  /** Cuerpo de respuesta cacheado para responder idempotentemente. */
  @Prop({ type: MongooseSchema.Types.Mixed })
  responseBody?: any;

  /** Fecha de creación (expira automáticamente después de 7 días vía TTL index). */
  @Prop({ default: () => new Date(), expires: 604800 })
  createdAt!: Date;
}

export const IdempotencyKeySchema = SchemaFactory.createForClass(IdempotencyKey);
