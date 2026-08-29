import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActuatorDocument = HydratedDocument<Actuator>;

export type ActuatorMode = 'auto' | 'manual' | 'ia';
export type ActuatorKind = 'pump' | 'aerator' | 'feeder';
export type ActuatorAction = 'on' | 'off' | 'dispense';

export interface ActuatorLock {
  clientId: string;
  expiresAt: Date;
}

@Schema({ timestamps: true, collection: 'actuators' })
export class Actuator {
  @Prop({ required: true, unique: true, index: true })
  id!: string;

  @Prop({ required: true })
  label!: string;

  @Prop({ required: true })
  kind!: ActuatorKind;

  @Prop({ default: 'manual' })
  mode!: ActuatorMode;

  @Prop({ default: false })
  on!: boolean;

  @Prop({ default: 0 })
  minStateMs!: number;

  @Prop({ default: 0 })
  lastChangeAt!: number;

  @Prop({ type: Object, default: null })
  currentLock!: ActuatorLock | null;

  @Prop()
  lastReason!: string;

  @Prop({ default: '' })
  lastActor!: string;
}

export const ActuatorSchema = SchemaFactory.createForClass(Actuator);
