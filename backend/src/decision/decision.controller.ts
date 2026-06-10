import { Body, Controller, Get, Post } from '@nestjs/common';
import { PumpDecisionService, PumpMode } from './pump-decision.service';
import { ReportService } from './report.service';

const VALID_MODES: PumpMode[] = ['auto', 'on', 'off'];

@Controller('decision')
export class DecisionController {
  constructor(
    private readonly pump: PumpDecisionService,
    private readonly report: ReportService,
  ) {}

  /** Estado actual de la bomba y su configuración. GET /decision/pump */
  @Get('pump')
  getPump() {
    return this.pump.getStatus();
  }

  /**
   * Cambia el modo de la bomba.
   * POST /decision/pump/mode  { "mode": "auto" | "on" | "off" }
   */
  @Post('pump/mode')
  setMode(@Body() body: { mode?: string }) {
    const mode = body?.mode as PumpMode;
    if (!VALID_MODES.includes(mode)) {
      return { ok: false, reason: `Modo inválido. Usa: ${VALID_MODES.join(', ')}` };
    }
    return { ok: true, status: this.pump.setMode(mode) };
  }

  /**
   * Genera y envía el reporte de progreso ahora.
   * POST /decision/report/now  { "windowHours"?: 24 }
   */
  @Post('report/now')
  async runReport(@Body() body: { windowHours?: number }) {
    const window =
      body?.windowHours && body.windowHours > 0 ? body.windowHours : undefined;
    return this.report.runNow(window);
  }
}
