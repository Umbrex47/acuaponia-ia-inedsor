import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface MailMessage {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private from = '';
  private recipients: string[] = [];

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('mail.host', '');
    this.from = this.config.get<string>('mail.from', '');
    this.recipients = this.config.get<string[]>('mail.to', []);

    if (!host) {
      this.logger.warn(
        'MAIL_HOST no configurado — las alertas por correo están deshabilitadas',
      );
      return;
    }

    if (this.recipients.length === 0) {
      this.logger.warn(
        'MAIL_TO vacío — no hay destinatarios para las alertas por correo',
      );
    }

    const user = this.config.get<string>('mail.user', '');
    const password = this.config.get<string>('mail.password', '');

    this.transporter = nodemailer.createTransport({
      host,
      port: this.config.get<number>('mail.port', 587),
      secure: this.config.get<boolean>('mail.secure', false),
      auth: user ? { user, pass: password } : undefined,
    });

    this.transporter
      .verify()
      .then(() => this.logger.log(`Servidor SMTP listo (${host})`))
      .catch((err: Error) =>
        this.logger.error(`No se pudo verificar SMTP: ${err.message}`),
      );
  }

  get isEnabled(): boolean {
    return this.transporter !== null && this.recipients.length > 0;
  }

  async send(message: MailMessage): Promise<boolean> {
    if (!this.transporter) {
      this.logger.debug('Correo no enviado: transporte SMTP no configurado');
      return false;
    }
    if (this.recipients.length === 0) {
      this.logger.debug('Correo no enviado: sin destinatarios');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: this.recipients,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      this.logger.log(`Alerta enviada: "${message.subject}"`);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error al enviar correo: ${msg}`);
      return false;
    }
  }
}
