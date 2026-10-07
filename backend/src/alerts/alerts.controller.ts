import { Body, Controller, Inject, Optional, Post, forwardRef } from '@nestjs/common';
import { AlertService } from './alert.service';
import { TelegramService } from './telegram.service';
import { AquaponicGateway } from '../aquaponic/aquaponic.gateway';

@Controller('alerts')
export class AlertsController {
  constructor(
    private readonly alerts: AlertService,
    private readonly telegram: TelegramService,
    @Optional()
    @Inject(forwardRef(() => AquaponicGateway))
    private readonly gateway?: AquaponicGateway,
  ) {}

  /**
   * Evalúa los parámetros enviados desde el formulario del dashboard y dispara
   * alertas a Telegram, Correo y WebSocket para cualquier valor fuera de rango.
   * Además retransmite las lecturas vía WebSocket a todas las pantallas abiertas.
   * Ej: POST /alerts/manual  { "sensors": { "temperatura": { "value": 34 } } }
   */
  @Post('manual')
  evaluateManual(@Body() body: unknown) {
    const result = this.alerts.notifyManual(body);

    // Retransmitir al dashboard WebSocket en tiempo real
    if (this.gateway && body) {
      try {
        this.gateway.broadcast(
          typeof body === 'string' ? body : JSON.stringify(body),
        );
      } catch {
        /* ignore */
      }
    }

    return {
      ok: true,
      evaluated: result.evaluated,
      outOfRange: result.outOfRange,
      humanActions: result.humanActions,
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
