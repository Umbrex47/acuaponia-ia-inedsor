import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReminderSchedulerService } from './reminder-scheduler.service';
import { AdminSettingsService } from './admin-settings.service';
import {
  CreateReminderDto,
  UpdateReminderDto,
  UpdateSettingsDto,
} from './dto/create-reminder.dto';
import { AdminGuard } from './guards/admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly scheduler: ReminderSchedulerService,
    private readonly settings: AdminSettingsService,
  ) {}

  // ── Fechas de Alerta y Recordatorios ──────────────────────────────
  /**
   * Lista todos los recordatorios y fechas de alerta programadas.
   * GET /admin/reminders
   */
  @Get('reminders')
  async listReminders() {
    return this.scheduler.listReminders();
  }

  /**
   * Programa una nueva alerta o recordatorio periódico (ej. cada 3 días).
   * POST /admin/reminders
   */
  @Post('reminders')
  async createReminder(@Body() body: CreateReminderDto, @Req() req: any) {
    const adminUser = req.adminUser || 'Admin';
    return this.scheduler.createReminder(body, adminUser);
  }

  /**
   * Actualiza o pausa/activa un recordatorio.
   * PATCH /admin/reminders/:id
   */
  @Patch('reminders/:id')
  async updateReminder(
    @Param('id') id: string,
    @Body() body: UpdateReminderDto,
  ) {
    return this.scheduler.updateReminder(id, body);
  }

  /**
   * Elimina un recordatorio.
   * DELETE /admin/reminders/:id
   */
  @Delete('reminders/:id')
  async deleteReminder(@Param('id') id: string) {
    return this.scheduler.deleteReminder(id);
  }

  /**
   * Dispara inmediatamente la alerta para pruebas en vivo.
   * POST /admin/reminders/:id/trigger-now
   */
  @Post('reminders/:id/trigger-now')
  async triggerNow(@Param('id') id: string) {
    return this.scheduler.triggerNow(id);
  }

  // ── Ajustes de Sistema y Notificaciones ───────────────────────────
  /**
   * Obtiene la configuración de notificaciones, canales activos y umbrales.
   * GET /admin/settings
   */
  @Get('settings')
  async getSettings() {
    return this.settings.getSettings();
  }

  /**
   * Modifica los canales de notificación, tiempo de cooldown o umbrales.
   * PATCH /admin/settings
   */
  @Patch('settings')
  async updateSettings(@Body() body: UpdateSettingsDto, @Req() req: any) {
    const adminUser = req.adminUser || 'Admin';
    return this.settings.updateSettings(body, adminUser);
  }
}
