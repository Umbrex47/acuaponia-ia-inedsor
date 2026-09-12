import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ActuatorsModule } from '../actuators/actuators.module';
import { ReadingsModule } from '../readings/readings.module';
import { AssistantController } from './assistant.controller';
import { AssistantGateway } from './assistant.gateway';
import { AssistantService } from './assistant.service';
import { GeminiService } from './gemini.service';
import {
  ChatSession,
  ChatSessionSchema,
} from './schemas/chat-session.schema';
import {
  AssistantProposal,
  AssistantProposalSchema,
} from './schemas/assistant-proposal.schema';

@Module({})
export class AssistantsModule {
  static forRoot(): DynamicModule {
    const uri = process.env.MONGODB_URI;
    const imports: NonNullable<DynamicModule['imports']> = [
      ActuatorsModule,
      ReadingsModule,
      ThrottlerModule.forRoot([{ name: 'short', ttl: 60_000, limit: 60 }]),
    ];

    if (uri) {
      imports.push(
        MongooseModule.forFeature([
          { name: ChatSession.name, schema: ChatSessionSchema },
          { name: AssistantProposal.name, schema: AssistantProposalSchema },
        ]),
      );
    }

    return {
      module: AssistantsModule,
      global: true,
      imports,
      controllers: [AssistantController],
      providers: [GeminiService, AssistantService, AssistantGateway],
      exports: [AssistantService, AssistantGateway],
    };
  }
}
