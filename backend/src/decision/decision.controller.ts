import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  AeratorDecisionService,
  AeratorMode,
} from './aerator-decision.service';
import { DecisionFlowService } from './decision-flow.service';
import {
  EarlyWarningReportService,
  SystemControlStatus,
} from './early-warning-report.service';
import { FilterCleaningAlertService } from './filter-cleaning-alert.service';
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

const VALID_PUMP_MODES: PumpMode[] = ['auto', 'on', 'off'];
const VALID_AERATOR_MODES: AeratorMode[] = ['auto', 'on', 'off'];

@Controller('decision')
export class DecisionController {
  constructor(
    private readonly pump: PumpDecisionService,
    private readonly aerator: AeratorDecisionService,
    private readonly filterAlert: FilterCleaningAlertService,
    private readonly earlyWarning: EarlyWarningReportService,
    private readonly report: ReportService,
    private readonly fishAssessment: FishAssessmentService,
    private readonly plantAssessment: PlantAssessmentService,
    private readonly flow: DecisionFlowService,
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
  setPumpMode(@Body() body: { mode?: string }) {
    const mode = body?.mode as PumpMode;
    if (!VALID_PUMP_MODES.includes(mode)) {
      return { ok: false, reason: `Modo inválido. Usa: ${VALID_PUMP_MODES.join(', ')}` };
    }
    return { ok: true, status: this.pump.setMode(mode) };
  }

  /** Estado actual del aireador y su configuración. GET /decision/aerator */
  @Get('aerator')
  getAerator() {
    return this.aerator.getStatus();
  }

  /**
   * Cambia el modo del aireador.
   * POST /decision/aerator/mode  { "mode": "auto" | "on" | "off" }
   */
  @Post('aerator/mode')
  setAeratorMode(@Body() body: { mode?: string }) {
    const mode = body?.mode as AeratorMode;
    if (!VALID_AERATOR_MODES.includes(mode)) {
      return { ok: false, reason: `Modo inválido. Usa: ${VALID_AERATOR_MODES.join(', ')}` };
    }
    return { ok: true, status: this.aerator.setMode(mode) };
  }

  /** Estado de alertas de limpieza de filtros. GET /decision/filter */
  @Get('filter')
  getFilterStatus() {
    return this.filterAlert.getStatus();
  }

  /** Estado del reporte de alerta temprana. GET /decision/early-warning */
  @Get('early-warning')
  getEarlyWarningStatus() {
    return this.earlyWarning.getStatus();
  }

  /**
   * Envía ahora el reporte de alerta temprana.
   * POST /decision/early-warning/now
   */
  @Post('early-warning/now')
  async runEarlyWarning() {
    return this.earlyWarning.runNow();
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

  /** Estado del flujo Alerta → IA → Normalización. GET /decision/flow */
  @Get('flow')
  getFlowStatus() {
    return this.flow.getStatus();
  }

  /** Bitácora de intervenciones. GET /decision/flow/logs?limit=20 */
  @Get('flow/logs')
  getFlowLogs(@Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 20;
    return {
      logs: this.flow.listLogs(Number.isFinite(parsed) ? parsed : 20),
    };
  }

  /** Limpia la bitácora. DELETE /decision/flow/logs */
  @Delete('flow/logs')
  clearFlowLogs() {
    this.flow.clearLogs();
    return { ok: true };
  }

  /** Cancela escalaciones pendientes. POST /decision/flow/cancel { sensor?: string } */
  @Post('flow/cancel')
  cancelFlow(@Body() body: { sensor?: string }) {
    const cancelled = this.flow.cancelPending(body?.sensor);
    return { ok: true, cancelled };
  }

  /**
   * Fuerza el ciclo sobre un sensor y un valor concreto (debug).
   * POST /decision/flow/run { sensor: 'oxigeno', value: 3.2 }
   */
  @Post('flow/run')
  async runFlow(@Body() body: { sensor?: string; value?: number }) {
    if (!body?.sensor || typeof body.value !== 'number') {
      return { ok: false, reason: 'sensor y value son requeridos' };
    }
    const log = await this.flow.forceCycle(body.sensor, body.value);
    return { ok: Boolean(log), log };
  }
}
