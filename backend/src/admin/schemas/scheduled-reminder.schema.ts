import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ScheduledReminderDocument = HydratedDocument<ScheduledReminder>;

export type ReminderType = 'recurring' | 'once';

/**
 * Esquema de fechas de alerta y recordatorios periódicos programados por administradores.
 * Permite definir alertas cada N días (ej: cada 3 días volver a chequear parámetros)
 * o en fechas específicas concretas.
 */
@Schema({ timestamps: true, collection: 'scheduled_reminders' })
export class ScheduledReminder {
  @Prop({ required: true, unique: true, index: true })
  id!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  // 'recurring' (cada N días) o 'once' (fecha única)
  @Prop({ default: 'recurring' })
  type!: ReminderType;

  /** Intervalo en días si es recurrente (ej: 3 para cada 3 días). */
  @Prop({ default: 3 })
  intervalDays!: number;

  /** Hora del día deseada en formato HH:mm (ej: "08:00"). */
  @Prop({ default: '08:00' })
  targetTime!: string;

  /** Fecha específica si es de tipo 'once'. */
  @Prop()
  specificDate?: Date;

  /** Lista de variables a revisar (ej: ['nitratos', 'nitritos', 'amonio', 'ph']). */
  @Prop({ type: [String], default: ['nitritos', 'amonio', 'ph', 'nitratos'] })
  targetVariables!: string[];

  /** Destinatarios o rol objetivo (ej: 'operadores', 'todos'). */
  @Prop({ default: 'todos' })
  targetRole!: string;

  /** Severidad de la notificación (info | warn | critical). */
  @Prop({ default: 'warn' })
  severity!: string;

  /** Si la alerta está activa o en pausa. */
  @Prop({ default: true, index: true })
  enabled!: boolean;

  /** Última fecha/hora en que se disparó. */
  @Prop()
  lastTriggeredAt?: Date;

  /** Próxima fecha/hora en que debe dispararse. */
  @Prop({ required: true, index: true })
  nextTriggerAt!: Date;

  /** Administrador que creó o programó la alerta. */
  @Prop({ required: true })
  createdBy!: string;
}

export const ScheduledReminderSchema = SchemaFactory.createForClass(ScheduledReminder);

ScheduledReminderSchema.index({ enabled: 1, nextTriggerAt: 1 });
