import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type IaActionLogDocument = HydratedDocument<IaActionLog>;
export type IaActionStatus = 'pending' | 'escalating' | 'acting' | 'recovering' | 'closed' | 'failed';

export interface IaActionStep {
  ts: string;
  phase: 'early-warning' | 'actor-decision' | 'recovery' | 'closed';
  actuatorId?: string;
  action?: string;
  reason?: string;
  ok?: boolean;
  detail?: string;
}

/**
 * Bitácora de una intervención del flujo Alerta → IA → Normalización.
 * Se persiste solo si MONGODB_URI está configurado; en memoria siempre vive
 * una copia (consultable vía /decision/flow/logs).
 */
@Schema({ timestamps: true, collection: 'ia_action_logs' })
export class IaActionLog {
  @Prop({ required: true, index: true })
  sensorKey!: string;

  @Prop()
  label!: string;

  @Prop()
  unit!: string;

  @Prop({ required: true })
  value!: number;

  @Prop({ required: true, index: true })
  level!: 'low' | 'high';

  @Prop({ type: Object, required: true, index: true })
  optimal!: { min: number; max: number };

  @Prop({ required: true, index: true })
  status!: IaActionStatus;

  @Prop({ required: true })
  firstSeenAt!: Date;

  @Prop()
  escalatedAt?: Date;

  @Prop()
  decidedAt?: Date;

  @Prop()
  recoveryStartedAt?: Date;

  @Prop()
  recoveryClosedAt?: Date;

  @Prop()
  recoveryMs?: number;

  @Prop()
  decisionSource?: 'gemini' | 'rules' | 'none';

  @Prop({ type: Array, default: [] })
  steps!: IaActionStep[];

  @Prop()
  summary?: string;
}

export const IaActionLogSchema = SchemaFactory.createForClass(IaActionLog);

IaActionLogSchema.index({ status: 1, firstSeenAt: -1 });
