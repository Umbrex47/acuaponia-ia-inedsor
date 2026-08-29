import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../security/api-key.guard';
import { ActuatorService, ActuatorMode } from './actuator.service';

@Controller('actuators')
export class ActuatorController {
  constructor(private readonly actuators: ActuatorService) {}

  @Get()
  list() {
    return this.actuators.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.actuators.getStatus(id);
  }

  @Post(':id/execute')
  @UseGuards(ApiKeyGuard)
  execute(
    @Param('id') id: string,
    @Body() body: { action?: 'on' | 'off' | 'dispense'; reason?: string; actor?: string },
  ) {
    const action = body?.action;
    if (!action || !['on', 'off', 'dispense'].includes(action)) {
      return { ok: false, reason: 'action inválido (on|off|dispense)' };
    }
    const actor = (body.actor as 'user' | 'ia' | 'emergency' | 'auto') ?? 'user';
    return this.actuators.execute(id, action, { reason: body.reason, actor });
  }

  @Post(':id/mode')
  @UseGuards(ApiKeyGuard)
  setMode(@Param('id') id: string, @Body() body: { mode?: ActuatorMode }) {
    const mode = body?.mode;
    if (!mode || !['auto', 'manual', 'ia'].includes(mode)) {
      return { ok: false, reason: 'mode inválido (auto|manual|ia)' };
    }
    return this.actuators.setMode(id, mode);
  }

  @Post(':id/lock')
  lock(@Param('id') id: string, @Body() body: { clientId?: string }) {
    if (!body?.clientId) return { ok: false, reason: 'clientId requerido' };
    return this.actuators.acquireLock(id, body.clientId);
  }

  @Post(':id/unlock')
  unlock(@Param('id') id: string, @Body() body: { clientId?: string }) {
    if (!body?.clientId) return { ok: false, reason: 'clientId requerido' };
    return this.actuators.releaseLock(id, body.clientId);
  }
}
