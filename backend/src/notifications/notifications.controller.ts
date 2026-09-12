import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  NotificationPayload,
  NotificationService,
  NotificationSeverity,
} from './notification.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  /**
   * Obtiene la lista de notificaciones e historial para la app móvil o el dashboard.
   * Ej: GET /notifications?unreadOnly=true&limit=20
   */
  @Get()
  async list(
    @Query('unreadOnly') unreadOnly?: string,
    @Query('severity') severity?: NotificationSeverity,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.notifications.listNotifications({
      unreadOnly: unreadOnly === 'true',
      severity,
      limit: limit ? parseInt(limit, 10) : 50,
      skip: skip ? parseInt(skip, 10) : 0,
    });
  }

  /**
   * Conteo de alertas no leídas (usado para badges en el icono de la campana en la app móvil).
   * Ej: GET /notifications/unread-count
   */
  @Get('unread-count')
  async unreadCount() {
    const unread = await this.notifications.countUnread();
    return { unread };
  }

  /**
   * Marca una notificación como leída.
   * Ej: PATCH /notifications/172600000-xyz/read
   */
  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @Body('readBy') readBy?: string,
  ) {
    return this.notifications.markAsRead(id, readBy);
  }

  /**
   * Marca todas las notificaciones como leídas.
   * Ej: PATCH /notifications/read-all
   */
  @Patch('read-all')
  async markAllRead(@Body('readBy') readBy?: string) {
    return this.notifications.markAllAsRead(readBy);
  }

  /**
   * Registra el token de notificaciones push del smartphone.
   * Ej: POST /notifications/push-token
   * { "token": "ExponentPushToken[xxxx]", "deviceName": "Samsung Galaxy S22", "userName": "Khris" }
   */
  @Post('push-token')
  async registerPushToken(
    @Body()
    body: {
      token: string;
      platform?: string;
      deviceName?: string;
      userName?: string;
    },
  ) {
    return this.notifications.registerPushSubscription(body);
  }

  /**
   * Emite una notificación manualmente (útil para pruebas o reportes desde campo).
   * Ej: POST /notifications
   */
  @Post()
  async emit(@Body() payload: NotificationPayload) {
    return this.notifications.emit(payload);
  }
}
