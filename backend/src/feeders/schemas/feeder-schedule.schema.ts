import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FeederScheduleDocument = HydratedDocument<FeederSchedule>;

@Schema({ timestamps: true, collection: 'feeder_schedules' })
export class FeederSchedule {
  @Prop({ required: true, unique: true, default: 'default' })
  _id!: string;

  @Prop({ type: [String], default: ['08:00', '12:00', '17:00'] })
  times!: string[];

  @Prop({ default: 20000 })
  durationMs!: number;

  @Prop({ default: 15 })
  portionG!: number;
}

export const FeederScheduleSchema = SchemaFactory.createForClass(FeederSchedule);
