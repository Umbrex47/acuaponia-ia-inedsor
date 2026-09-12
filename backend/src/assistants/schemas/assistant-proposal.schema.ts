import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AssistantProposalDocument = HydratedDocument<AssistantProposal>;
export type ProposalDocument = HydratedDocument<AssistantProposal>;

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ProposalSource = 'ia' | 'emergency';

@Schema({ timestamps: true, collection: 'assistant_proposals' })
export class AssistantProposal {
  @Prop({ required: true, unique: true })
  id!: string;

  @Prop({ required: true, index: true })
  actuatorId!: string;

  @Prop({ required: true })
  action!: string;

  @Prop({ default: '' })
  reason!: string;

  @Prop({ required: true })
  source!: ProposalSource;

  @Prop({ default: 'pending', index: true })
  status!: ProposalStatus;

  @Prop({ default: '' })
  decidedBy!: string;

  @Prop({ index: true })
  expiresAt!: Date;

  @Prop({ default: () => new Date() })
  createdAt!: Date;

  @Prop()
  decidedAt!: Date;
}

export const AssistantProposalSchema = SchemaFactory.createForClass(AssistantProposal);
