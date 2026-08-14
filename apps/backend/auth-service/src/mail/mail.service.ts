import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createTestAccount,
  createTransport,
  getTestMessageUrl,
  type Transporter,
} from 'nodemailer';

/**
 * Único punto de envío de correo del servicio. Si no hay SMTP_HOST
 * configurado (entorno local), usa una cuenta de prueba Ethereal para poder
 * ver el correo real sin depender de un proveedor externo; si ni eso está
 * disponible (sin internet), cae a un transporte "jsonTransport" que solo
 * registra el mensaje en el log, dejando claro que no se entregó de verdad.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;
  private from = 'NextTicket <no-reply@nextticket.local>';
  private deliversForReal = true;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    this.from = this.config.get<string>('MAIL_FROM') ?? this.from;
    const host = this.config.get<string>('SMTP_HOST');

    if (host) {
      this.transporter = createTransport({
        host,
        port: Number(this.config.get<string>('SMTP_PORT') ?? 587),
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: this.config.get<string>('SMTP_USER')
          ? {
              user: this.config.get<string>('SMTP_USER'),
              pass: this.config.get<string>('SMTP_PASS'),
            }
          : undefined,
      });
      return;
    }

    try {
      const testAccount = await createTestAccount();
      this.transporter = createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      this.logger.warn(
        'SMTP_HOST no configurado: usando una cuenta de prueba Ethereal. ' +
          'Los correos no llegan a bandejas reales, revisa la URL de vista previa en el log.',
      );
    } catch (error) {
      this.deliversForReal = false;
      this.transporter = createTransport({ jsonTransport: true });
      this.logger.warn(
        `No se pudo crear una cuenta de prueba Ethereal (${(error as Error).message}). ` +
          'Los correos solo se registrarán en el log, no se enviarán.',
      );
    }
  }

  async send(to: string, subject: string, html: string, text: string) {
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text,
    });

    const preview = this.deliversForReal ? getTestMessageUrl(info) : null;
    if (preview) {
      this.logger.log(`Vista previa del correo "${subject}" para ${to}: ${preview}`);
    }
    if (!this.deliversForReal) {
      this.logger.log(`Correo "${subject}" para ${to} (no enviado, solo log):\n${text}`);
    }

    return info;
  }
}
