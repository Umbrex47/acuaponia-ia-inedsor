import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  FishAssessmentService,
  FishTelemetry,
} from './fish-assessment.service';
import {
  PlantAssessmentService,
  PlantTelemetry,
} from './plant-assessment.service';
import { PumpDecisionService, PumpMode } from './pump-decision.service';
import { ReportService } from './report.service';

const VALID_MODES: PumpMode[] = ['auto', 'on', 'off'];

@Controller('decision')
export class DecisionController {
  constructor(
    private readonly pump: PumpDecisionService,
    private readonly report: ReportService,
    private readonly fishAssessment: FishAssessmentService,
    private readonly plantAssessment: PlantAssessmentService,
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

  /** Última telemetría/assessment de peces. GET /decision/fish-assessment */
  @Get('fish-assessment')
  getFishAssessment() {
    return { fish: this.fishAssessment.getLastFish() };
  }

  /**
   * Envía ahora el correo de evaluación conductual.
   * POST /decision/fish-assessment/now  { "fish"?: {...} }
   */
  @Post('fish-assessment/now')
  async runFishAssessment(@Body() body: { fish?: FishTelemetry }) {
    return this.fishAssessment.runNow(body);
  }

  /** Última telemetría/assessment de plantas. GET /decision/plant-assessment */
  @Get('plant-assessment')
  getPlantAssessment() {
    return { plants: this.plantAssessment.getLastPlants() };
  }

  /**
   * Envía ahora el correo de evaluación de plantas.
   * POST /decision/plant-assessment/now
   */
  @Post('plant-assessment/now')
  async runPlantAssessment(@Body() body: { plants?: PlantTelemetry }) {
    return this.plantAssessment.runNow(body);
  }
}
