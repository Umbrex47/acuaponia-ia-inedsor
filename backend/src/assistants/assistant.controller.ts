import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { AssistantService } from './assistant.service';

interface ChatBody {
  clientId?: string;
  message?: string;
}

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  async chat(@Body() body: ChatBody) {
    const clientId = body.clientId || 'default';
    const message = (body.message ?? '').trim();
    if (!message) return { ok: false, reason: 'message requerido' };
    return this.assistant.chat(clientId, message);
  }

  @Get('history')
  async history(@Query('clientId') clientId?: string) {
    const id = clientId || 'default';
    return this.assistant.getHistory(id);
  }

  @Get('proposals')
  async proposals() {
    return this.assistant.listProposals();
  }

  @Post('proposals/resolve')
  async resolve(
    @Body() body: { proposalId?: string; decision?: 'approved' | 'rejected'; decidedBy?: string },
  ) {
    if (!body.proposalId || !body.decision) {
      return { ok: false, reason: 'proposalId y decision requeridos' };
    }
    return this.assistant.resolveProposal(
      body.proposalId,
      body.decision,
      body.decidedBy ?? 'dashboard',
    );
  }
}
