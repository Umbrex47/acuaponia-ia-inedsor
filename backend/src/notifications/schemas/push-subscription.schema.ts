import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PushSubscriptionDocument = HydratedDocument<PushSubscription>;

@Schema({ timestamps: true, collection: 'push_subscriptions' })
export class PushSubscription {
  @Prop({ required: true, unique: true, index: true })
  token!: string;

  @Prop({ default: 'expo' })
  platform!: string; // expo | fcm | web

  @Prop({ default: 'Dispositivo móvil' })
  deviceName!: string;

  @Prop()
  userName?: string;

  @Prop({ default: true })
  active!: boolean;

  @Prop({ default: () => new Date() })
  lastActiveAt!: Date;
}

export const PushSubscriptionSchema = SchemaFactory.createForClass(PushSubscription);
