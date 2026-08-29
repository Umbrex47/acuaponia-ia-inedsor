import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChatSessionDocument = HydratedDocument<ChatSession>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
    /** Firma de pensamiento de Gemini para llamadas a funciones. */
    thoughtSignature?: string;
  }>;
  tool_call_id?: string;
  name?: string;
  ts?: string;
}

@Schema({ timestamps: true, collection: 'chat_sessions', expireAfterSeconds: 60 * 60 * 24 * 30 })
export class ChatSession {
  @Prop({ required: true, unique: true })
  clientId!: string;

  @Prop({ type: Array, default: [] })
  messages!: ChatMessage[];

  @Prop({ default: () => new Date(), index: true })
  lastActiveAt!: Date;
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession);
