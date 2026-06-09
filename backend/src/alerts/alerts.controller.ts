import { Body, Controller, Post } from '@nestjs/common';
import { AlertService } from './alert.service';
import { TelegramService } from './telegram.service';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertService,
    private readonly telegram: TelegramService,
  ) {}

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

  /**
   * Envía un mensaje de prueba a Telegram para verificar la configuración
   * (token + chat ids) sin esperar a que un sensor se salga de rango.
   * Ej: POST /alerts/test-telegram  { "message": "Hola desde Aquaponía" }
   */
  @Post('test-telegram')
  async testTelegram(@Body() body: { message?: string }) {
    if (!this.telegram.isEnabled) {
      return {
        ok: false,
        reason:
          'Telegram no está configurado (revisa TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_IDS)',
      };
    }

    const timestamp = new Date().toLocaleString('es-MX', {
      timeZone: 'America/Mexico_City',
    });
    const custom = body?.message?.trim();
    const text = [
      '✅ <b>Prueba de Aquaponía</b>',
      '',
      custom || 'La integración con Telegram funciona correctamente.',
      `<b>Fecha:</b> ${timestamp}`,
    ].join('\n');

    const sent = await this.telegram.send({ text });
    return {
      ok: sent,
      reason: sent ? undefined : 'No se pudo entregar el mensaje a ningún chat',
    };
  }
}
