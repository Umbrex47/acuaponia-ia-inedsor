import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TelegramMessage {
  /** Texto del mensaje. Admite el subconjunto HTML de Telegram (<b>, <i>, <a>…). */
  text: string;
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
}

/**
 * Envía notificaciones a uno o varios chats de Telegram mediante la Bot API.
 * Se configura con TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_IDS. Si falta el token
 * o no hay chats, el servicio queda deshabilitado silenciosamente.
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private botToken = '';
  private chatIds: string[] = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.botToken = this.config.get<string>('telegram.botToken', '');
    this.chatIds = this.config.get<string[]>('telegram.chatIds', []);

    if (!this.botToken) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN no configurado — las alertas por Telegram están deshabilitadas',
      );
      return;
    }

    if (this.chatIds.length === 0) {
      this.logger.warn(
        'TELEGRAM_CHAT_IDS vacío — no hay destinatarios para las alertas por Telegram',
      );
      return;
    }

    this.logger.log(
      `Telegram listo — ${this.chatIds.length} chat(s) destino`,
    );
  }

  get isEnabled(): boolean {
    return this.botToken !== '' && this.chatIds.length > 0;
  }

  /** Envía un mensaje a todos los chats configurados. Devuelve true si al menos uno se entregó. */
  async send(message: TelegramMessage): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.debug('Telegram no enviado: bot o destinatarios sin configurar');
      return false;
    }

    const results = await Promise.all(
      this.chatIds.map((chatId) => this.sendToChat(chatId, message.text)),
    );
    return results.some(Boolean);
  }

  private async sendToChat(chatId: string, text: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const data = (await response.json()) as TelegramApiResponse;

      if (!response.ok || !data.ok) {
        this.logger.error(
          `Telegram rechazó el envío a ${chatId}: ${data.description ?? response.statusText}`,
        );
        return false;
      }

      this.logger.log(`Alerta enviada a Telegram (chat ${chatId})`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar a Telegram (${chatId}): ${msg}`);
      return false;
    }
  }
}
