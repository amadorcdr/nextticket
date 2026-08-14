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

const RESET_TOKEN_PREFIX = 'auth:password-reset:token:';
const RESET_USER_INDEX_PREFIX = 'auth:password-reset:user:';
const DEFAULT_TTL_MINUTES = 60;

export interface ResettableUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Mecanismo de recuperación de contraseña: token de un solo uso en Redis con
 * TTL, igual patrón que ActivationService y que el `state` de OAuth
 * (auth.service.ts), pero con su propio prefijo/TTL/propósito — un token de
 * activación NUNCA sirve aquí y viceversa, aunque comparten la misma "forma"
 * de infraestructura (Redis + MailService).
 *
 * A diferencia de la activación, aquí sí hace falta un índice inverso
 * (`auth:password-reset:user:<id>` -> token vigente) porque el requisito es
 * que solo exista un enlace de recuperación válido por usuario: al pedir uno
 * nuevo, el anterior se invalida.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private ttlSeconds() {
    const minutes = Number(
      this.config.get<string>('PASSWORD_RESET_TOKEN_TTL_MINUTES') ?? DEFAULT_TTL_MINUTES,
    );
    return minutes * 60;
  }

  async issueAndSendReset(user: ResettableUser) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    if (!frontendUrl) {
      throw new BadRequestException('FRONTEND_URL no está configurado');
    }

    // Solo puede haber un enlace vigente por usuario: si ya pidió uno antes
    // y sigue vivo, se invalida para que el correo anterior deje de servir.
    const userIndexKey = `${RESET_USER_INDEX_PREFIX}${user.id}`;
    const previousToken = await this.redis.get<string>(userIndexKey);
    if (previousToken) {
      await this.redis.del(`${RESET_TOKEN_PREFIX}${previousToken}`);
    }

    const ttlSeconds = this.ttlSeconds();
    const token = randomUUID();
    await this.redis.set(`${RESET_TOKEN_PREFIX}${token}`, { userId: user.id }, ttlSeconds);
    await this.redis.set(userIndexKey, token, ttlSeconds);

    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    const minutes = Math.round(ttlSeconds / 60);

    const text =
      `Hola ${user.name},\n\n` +
      `Recibimos una solicitud para cambiar la contraseña de tu cuenta de NextTicket.\n` +
      `Restablécela en el siguiente enlace (válido por ${minutes} minutos):\n` +
      `${resetUrl}\n\n` +
      `Si no solicitaste este cambio, puedes ignorar este correo.`;

    const html =
      `<p>Hola ${user.name},</p>` +
      `<p>Recibimos una solicitud para cambiar la contraseña de tu cuenta de <strong>NextTicket</strong>.</p>` +
      `<p><a href="${resetUrl}">Restablecer contraseña</a></p>` +
      `<p>Este enlace tiene una vigencia limitada (${minutes} minutos).</p>` +
      `<p>Si no solicitaste este cambio, puedes ignorar este correo.</p>`;

    try {
      await this.mail.send(user.email, 'Restablecer contraseña de NextTicket', html, text);
    } catch (error) {
      // No se revierte el token: el usuario puede pedir "reenviar" y aquí
      // mismo se invalidaría el que acabamos de generar. Se registra el
      // fallo real en vez de responder como si el correo hubiera salido.
      this.logger.error(`No se pudo enviar el correo de recuperación: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        `No se pudo enviar el correo de recuperación. Intenta de nuevo más tarde. (${(error as Error).message})`,
      );
    }
  }

  /** El token se borra al leerlo (y su índice inverso): solo sirve una vez. */
  async consumeToken(token: string): Promise<{ userId: string }> {
    const key = `${RESET_TOKEN_PREFIX}${token}`;
    const stored = await this.redis.get<{ userId: string }>(key);

    if (!stored) {
      throw new BadRequestException('El enlace de recuperación no es válido o ha expirado.');
    }

    await this.redis.del(key);
    await this.redis.del(`${RESET_USER_INDEX_PREFIX}${stored.userId}`);
    return stored;
  }

  /**
   * El usuario dice "yo no pedí esto": se invalida el token sin tocar la
   * contraseña. Siempre resuelve en silencio (no hay nada que confirmar ni
   * negar sobre la validez del token).
   */
  async discardToken(token: string): Promise<void> {
    const key = `${RESET_TOKEN_PREFIX}${token}`;
    const stored = await this.redis.get<{ userId: string }>(key);
    await this.redis.del(key);
    if (stored) {
      await this.redis.del(`${RESET_USER_INDEX_PREFIX}${stored.userId}`);
    }
  }

  /** Aviso informativo tras un cambio exitoso; nunca incluye la contraseña. */
  async notifyPasswordChanged(user: ResettableUser) {
    const text =
      `Hola ${user.name},\n\n` +
      `La contraseña de tu cuenta de NextTicket se actualizó correctamente.\n` +
      `Si no fuiste tú, contacta a un administrador de inmediato.`;

    const html =
      `<p>Hola ${user.name},</p>` +
      `<p>La contraseña de tu cuenta de <strong>NextTicket</strong> se actualizó correctamente.</p>` +
      `<p>Si no fuiste tú, contacta a un administrador de inmediato.</p>`;

    try {
      await this.mail.send(user.email, 'Tu contraseña de NextTicket fue modificada', html, text);
    } catch (error) {
      // Es solo un aviso informativo: si falla, no debe tumbar la respuesta
      // exitosa del cambio de contraseña (que ya ocurrió de verdad).
      this.logger.error(
        `No se pudo enviar el aviso de cambio de contraseña: ${(error as Error).message}`,
      );
    }
  }
}
