import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../security/api-key.guard';
import { FeederSchedulerService } from './feeder-scheduler.service';

@Controller('feeder')
export class FeederController {
  constructor(private readonly feeder: FeederSchedulerService) {}

  @Get('schedule')
  get() {
    return this.feeder.getConfig();
  }

  @Post('schedule')
  @UseGuards(ApiKeyGuard)
  update(@Body() body: { times?: string[]; durationMs?: number; portionG?: number }) {
    try {
      return { ok: true, config: this.feeder.updateSchedule(body) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, reason: msg };
    }
  }

  @Post('dispense')
  @UseGuards(ApiKeyGuard)
  dispense() {
    return this.feeder.dispenseNow();
  }
}
