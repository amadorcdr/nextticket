import {
  BadRequestException,
  Injectable,
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
      `Se creó una cuenta en NextTicket para ti con el rol ${roleLabel}.\n` +
      `Actívala y establece tu contraseña en el siguiente enlace (válido por ${hours} horas):\n` +
      `${activationUrl}\n`;

    const html =
      `<p>Hola ${user.name},</p>` +
      `<p>Se creó una cuenta en <strong>NextTicket</strong> para ti con el rol <strong>${roleLabel}</strong>.</p>` +
      `<p>Actívala y establece tu contraseña en el siguiente enlace (válido por ${hours} horas):</p>` +
      `<p><a href="${activationUrl}">${activationUrl}</a></p>`;

    try {
      await this.mail.send(user.email, 'Activa tu cuenta de NextTicket', html, text);
    } catch (error) {
      throw new ServiceUnavailableException(
        'El usuario se creó, pero no se pudo enviar el correo de activación. ' +
          `Intenta reenviarlo más tarde. (${(error as Error).message})`,
      );
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
