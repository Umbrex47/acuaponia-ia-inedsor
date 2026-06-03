import { Body, Controller, Post } from '@nestjs/common';
import { AlertService } from './alert.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertService) {}

  /**
   * Evalúa los parámetros enviados desde el formulario del dashboard y dispara
   * correos para cualquier valor fuera de rango.
   * Acepta el mismo formato que el resto del sistema: { sensors: {...} } o los
   * sensores en la raíz.
   * Ej: POST /alerts/manual  { "sensors": { "temperatura": { "value": 34 } } }
   */
  @Post('manual')
  evaluateManual(@Body() body: unknown) {
    const result = this.alerts.notifyManual(body);
    return {
      ok: true,
      evaluated: result.evaluated,
      outOfRange: result.outOfRange,
    };
  }
}
