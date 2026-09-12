import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';

export type SystemSettingsDocument = HydratedDocument<SystemSettings>;

@Schema({ timestamps: true, collection: 'system_settings' })
export class SystemSettings {
  @Prop({ default: 'global', unique: true })
  key!: string;

  /** Canales de notificación activos (websocket, push, email, telegram). */
  @Prop({ type: [String], default: ['websocket', 'push'] })
  notificationChannels!: string[];

  /** Tiempo de cooldown anti-spam en minutos. */
  @Prop({ default: 60 })
  cooldownMinutes!: number;

  /** Intervalo predeterminado de recordatorio de muestreo en días (ej: 3). */
  @Prop({ default: 3 })
  defaultSamplingDays!: number;

  /** Umbrales personalizados opcionales por sensor. */
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  customThresholds!: Record<string, { min?: number; max?: number }>;

  /** Código de acceso o PIN de administrador para la app móvil. */
  @Prop({ default: 'admin123' })
  adminPasscode!: string;

  /** Último administrador que modificó los ajustes. */
  @Prop({ default: 'Sistema' })
  updatedBy!: string;
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
