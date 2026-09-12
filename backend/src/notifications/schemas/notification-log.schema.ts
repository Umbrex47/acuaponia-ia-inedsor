import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { NotificationCategory, NotificationSeverity } from '../notification.service';

export type NotificationLogDocument = HydratedDocument<NotificationLog>;

/**
 * Registro persistente de notificaciones y alertas generadas en el sistema.
 * Permite mantener el historial de alertas para la app móvil y el dashboard,
 * con estado de lectura (read/unread) y timestamp.
 */
@Schema({ timestamps: true, collection: 'notifications_log' })
export class NotificationLog {
  @Prop({ required: true, unique: true, index: true })
  id!: string;

  @Prop({ required: true, index: true })
  category!: NotificationCategory;

  @Prop({ required: true, index: true })
  severity!: NotificationSeverity;

  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  message!: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  meta?: Record<string, unknown>;

  @Prop({ default: 'system', index: true })
  source!: string;

  @Prop({ required: true, index: true })
  ts!: Date;

  @Prop({ default: false, index: true })
  read!: boolean;

  @Prop()
  readAt?: Date;

  @Prop()
  readBy?: string;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);

NotificationLogSchema.index({ read: 1, ts: -1 });
NotificationLogSchema.index({ severity: 1, ts: -1 });
