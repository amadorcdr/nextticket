import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';

const ACTIVATION_TOKEN_PREFIX = 'auth:activation:token:';
const DEFAULT_TTL_HOURS = 48;

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Cliente',
  ORGANIZER: 'Organizador',
  VALIDATOR: 'Validador',
  ADMIN: 'Administrador',
};

const BUTTON_STYLE =
  'display:inline-block;padding:10px 22px;background-color:#0d84f8;' +
  'color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;';

export interface ActivatableUser {
  id: string;
  name: string;
  email: string;
  role: { name: string };
}

/**
 * Único mecanismo de activación de cuenta del servicio: lo usan tanto el
 * registro de Cliente como el alta de Organizador/Validador por parte del
 * ADMIN. El token sigue el mismo patrón que el `state` de OAuth (auth.service.ts):
 * un valor de un solo uso guardado en Redis con TTL, que se borra al
 * consumirse, así que "expirado", "ya usado" e "inválido" son indistinguibles
 * a propósito (no hay nada más que decir sobre un token que ya no está).
 */
@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private ttlSeconds() {
    const hours = Number(
      this.config.get<string>('ACTIVATION_TOKEN_TTL_HOURS') ?? DEFAULT_TTL_HOURS,
    );
    return hours * 60 * 60;
  }

  async issueAndSendActivation(user: ActivatableUser) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new BadRequestException('FRONTEND_URL no está configurado');
    }

    const ttlSeconds = this.ttlSeconds();
    const token = randomUUID();
    await this.redis.set(
      `${ACTIVATION_TOKEN_PREFIX}${token}`,
      { userId: user.id },
      ttlSeconds,
    );

    const activationUrl = `${frontendUrl.replace(/\/$/, '')}/activate-account?token=${token}`;
    const roleLabel = ROLE_LABELS[user.role.name] ?? user.role.name;
    const hours = Math.round(ttlSeconds / 3600);

    const text =
      `Hola ${user.name},\n\n` +
      `Se creó una cuenta en NextTicket para ti con el rol de ${roleLabel}. ` +
      `Solo falta un paso para empezar a usarla: activarla y crear tu contraseña.\n\n` +
      `Hazlo desde el siguiente enlace, vigente por las próximas ${hours} horas:\n` +
      `${activationUrl}\n\n` +
      `Si tú no solicitaste esta cuenta, puedes ignorar este correo sin problema.\n\n` +
      `— El equipo de NextTicket`;

    const html =
      `<p>Hola ${user.name},</p>` +
      `<p>Se creó una cuenta en <strong>NextTicket</strong> para ti con el rol de <strong>${roleLabel}</strong>. ` +
      `Solo falta un paso para empezar a usarla: activarla y crear tu contraseña.</p>` +
      `<p><a href="${activationUrl}" style="${BUTTON_STYLE}">Activar mi cuenta</a></p>` +
      `<p>Este enlace está vigente por las próximas ${hours} horas.</p>` +
      `<p>Si tú no solicitaste esta cuenta, puedes ignorar este correo sin problema.</p>` +
      `<p>— El equipo de NextTicket</p>`;

    try {
      await this.mail.send(user.email, 'Activa tu cuenta de NextTicket', html, text);
    } catch (error) {
      throw new ServiceUnavailableException(
        'El usuario se creó, pero no se pudo enviar el correo de activación. ' +
          `Intenta reenviarlo más tarde. (${(error as Error).message})`,
      );
    }
  }

  /**
   * Aviso de bienvenida tras una activación exitosa. Es puramente informativo
   * (la cuenta ya quedó activa antes de llamar esto), así que un fallo de
   * envío se registra pero nunca debe tumbar la respuesta de activación.
   */
  async sendWelcomeEmail(user: ActivatableUser) {
    const roleLabel = ROLE_LABELS[user.role.name] ?? user.role.name;
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const loginUrl = frontendUrl ? `${frontendUrl.replace(/\/$/, '')}/sign-in` : null;

    const text =
      `Hola ${user.name},\n\n` +
      `¡Bienvenido a NextTicket! Tu cuenta ya está activa y lista para usarse como ${roleLabel}.\n\n` +
      `A partir de ahora puedes iniciar sesión, descubrir eventos y gestionar tus boletos ` +
      `desde un solo lugar.` +
      (loginUrl ? `\n\nInicia sesión aquí:\n${loginUrl}\n` : '\n') +
      `\nGracias por unirte, ¡nos alegra tenerte con nosotros!\n\n` +
      `— El equipo de NextTicket`;

    const html =
      `<p>Hola ${user.name},</p>` +
      `<p>¡Bienvenido a <strong>NextTicket</strong>! Tu cuenta ya está activa y lista para usarse como ` +
      `<strong>${roleLabel}</strong>.</p>` +
      `<p>A partir de ahora puedes iniciar sesión, descubrir eventos y gestionar tus boletos desde un solo lugar.</p>` +
      (loginUrl ? `<p><a href="${loginUrl}" style="${BUTTON_STYLE}">Iniciar sesión</a></p>` : '') +
      `<p>Gracias por unirte, ¡nos alegra tenerte con nosotros!</p>` +
      `<p>— El equipo de NextTicket</p>`;

    try {
      await this.mail.send(user.email, '¡Bienvenido a NextTicket!', html, text);
    } catch (error) {
      this.logger.error(`No se pudo enviar el correo de bienvenida: ${(error as Error).message}`);
    }
  }

  /** El token se borra al leerlo: solo sirve una vez. */
  async consumeToken(token: string): Promise<{ userId: string }> {
    const key = `${ACTIVATION_TOKEN_PREFIX}${token}`;
    const stored = await this.redis.get<{ userId: string }>(key);

    if (!stored) {
      throw new BadRequestException('El enlace de activación no es válido o ha expirado.');
    }

    await this.redis.del(key);
    return stored;
  }
}
