import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActuatorActionDocument = HydratedDocument<ActuatorActionLog>;

@Schema({ timestamps: true, collection: 'actuator_actions', expireAfterSeconds: 60 * 60 * 24 * 90 })
export class ActuatorActionLog {
  @Prop({ required: true, index: true })
  actuatorId!: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  actor!: string;

  @Prop({ default: '' })
  reason!: string;

  @Prop()
  source!: string;

  @Prop({ index: true })
  ts!: Date;
}

export const ActuatorActionSchema = SchemaFactory.createForClass(ActuatorActionLog);
