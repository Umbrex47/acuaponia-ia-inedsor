import { Body, Controller, Get, Post } from '@nestjs/common';
import { DemoScenario, DemoTelemetryService } from './demo-telemetry.service';

const VALID_SCENARIOS: DemoScenario[] = [
  'stable',
  'realistic',
  'unstable',
  'chaotic',
  'lowOxygen',
  'lowPh',
  'highTurbidity',
  'highEC',
  'dryTank',
  'normalization',
];

@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoTelemetryService) {}

  /** Estado actual de la simulación. */
  @Get('status')
  getStatus() {
    return this.demo.getStatus();
  }

  /**
   * Cambia el escenario de simulación.
   * POST /demo/scenario { "scenario": "stable" | "lowOxygen" | "lowPh" | ... }
   */
  @Post('scenario')
  setScenario(@Body() body: { scenario?: string }) {
    const scenario = body?.scenario as DemoScenario;
    if (!VALID_SCENARIOS.includes(scenario)) {
      return {
        ok: false,
        reason: `Escenario inválido. Usa: ${VALID_SCENARIOS.join(', ')}`,
      };
    }
    return this.demo.setScenario(scenario);
  }
}
