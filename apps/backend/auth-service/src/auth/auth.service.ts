import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { sign, type SignOptions } from 'jsonwebtoken';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { ActivationService } from '../activation/activation.service';
import { PasswordResetService } from '../password-reset/password-reset.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AUTH_PROVIDERS } from './auth.constants';

type JwtUser = {
  sub: string;
  email: string;
  role: string;
};

const INVALID_CREDENTIALS = 'Credenciales inválidas';
const OAUTH_STATE_PREFIX = 'auth:oauth:state:';
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

/**
 * Hash bcrypt de una contraseña que nadie usa. Sirve para gastar el mismo
 * tiempo cuando el correo no existe, y que no se pueda averiguar qué correos
 * están registrados midiendo cuánto tarda la respuesta.
 */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.uQmQWQ0WlKQFYCPvJZ1tqZ9BvVvC';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly activation: ActivationService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async onModuleInit() {
    await this.usersService.ensureDefaultRoles();
  }

  /**
   * Autorregistro de Cliente: crea la cuenta como PENDING (sin contraseña) y
   * envía el correo de activación. Es el mismo camino que usa el ADMIN al
   * dar de alta Organizador/Validador (ver UsersService.create) — ya no
   * inicia sesión automáticamente, porque todavía no tiene contraseña.
   */
  async register(dto: RegisterDto) {
    const user = await this.usersService.createLocalUser(dto);
    await this.activation.issueAndSendActivation(user);
    return {
      message: 'Registro exitoso. Revisa tu correo para activar tu cuenta.',
      email: user.email,
    };
  }

  /** Reenvía el correo de activación; no revela si el correo existe o ya está activo. */
  async resendActivation(email: string) {
    const user = await this.usersService.findByEmailForAuth(email);
    if (user?.accountStatus === 'PENDING') {
      await this.activation.issueAndSendActivation(user);
    }
    return {
      message:
        'Si el correo corresponde a una cuenta pendiente de activación, se envió un nuevo enlace.',
    };
  }

  /** Único punto de activación: lo usan Cliente, Organizador y Validador por igual. */
  async activateAccount(dto: ActivateAccountDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const { userId } = await this.activation.consumeToken(dto.token);
    const user = await this.usersService.findPublicById(userId);

    if (user.accountStatus === 'ACTIVE') {
      throw new ConflictException('Esta cuenta ya fue activada.');
    }

    await this.usersService.setPasswordAndActivate(userId, dto.password);
    return { message: 'Tu cuenta ha sido activada correctamente.' };
  }

  /**
   * Recuperación de contraseña — mismo flujo para los 4 roles, la cuenta se
   * identifica solo por correo. Respuesta siempre genérica: no revela si el
   * correo existe, si está pendiente de activación o si es una cuenta de
   * Google sin contraseña local (ninguna de esas recibe el enlace).
   */
  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmailForAuth(email);
    const eligible =
      !!user && user.accountStatus === 'ACTIVE' && user.provider === AUTH_PROVIDERS.LOCAL;

    if (eligible) {
      await this.passwordReset.issueAndSendReset(user);
    }

    return {
      message:
        'Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu contraseña.',
    };
  }

  /** El usuario dice "yo no pedí esto": invalida el token sin tocar nada más. */
  async discardPasswordReset(token: string) {
    await this.passwordReset.discardToken(token);
    return { message: 'Solicitud de recuperación descartada.' };
  }

  /** Único punto de recuperación: mismo camino para Cliente, Organizador, Validador y Admin. */
  async resetPassword(dto: ResetPasswordDto) {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

    const { userId } = await this.passwordReset.consumeToken(dto.token);
    const user = await this.usersService.setPassword(userId, dto.password);

    await this.passwordReset.notifyPasswordChanged(user);

    return { message: 'Tu contraseña se actualizó correctamente.' };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailForAuth(dto.email);

    // Siempre se compara, exista o no el usuario: mismo costo, mismo mensaje.
    const passwordMatches = await compare(
      dto.password,
      user?.password ?? DUMMY_HASH,
    );

    if (!user?.password || !passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!user.status) {
      throw new ForbiddenException(
        'Tu cuenta está deshabilitada. Contacta a un administrador.',
      );
    }

    const publicUser = await this.usersService.findPublicById(user.id);

    return {
      token: this.signToken({
        sub: publicUser.id,
        email: publicUser.email,
        role: publicUser.role.name,
      }),
      user: publicUser,
    };
  }

  async getGoogleAuthUrl() {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientId || !callbackUrl) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    // state de un solo uso contra CSRF: sin esto, alguien puede provocar
    // que inicies sesion con SU cuenta de Google desde tu navegador.
    const state = randomUUID();
    await this.redis.set(
      `${OAUTH_STATE_PREFIX}${state}`,
      { createdAt: new Date().toISOString() },
      OAUTH_STATE_TTL_SECONDS,
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string, state?: string) {
    if (!code) {
      throw new BadRequestException('Google authorization code is required');
    }

    await this.consumeOAuthState(state);

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackUrl = this.configService.get<string>('GOOGLE_CALLBACK_URL');

    if (!clientId || !clientSecret || !callbackUrl) {
      throw new BadRequestException('Google OAuth is not configured');
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      throw new UnauthorizedException('Google authorization failed');
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      throw new UnauthorizedException('Google access token was not returned');
    }

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new UnauthorizedException('Google profile could not be loaded');
    }

    const profile = (await profileResponse.json()) as {
      id: string;
      email: string;
      name?: string;
      verified_email?: boolean;
    };

    if (!profile.email) {
      throw new UnauthorizedException('Google profile has no email');
    }

    // Vincular por correo solo es seguro si Google confirma que es suyo:
    // si no, se podria tomar la cuenta de un usuario local con ese correo.
    if (profile.verified_email === false) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const user = await this.usersService.upsertOAuthUser({
      name: profile.name ?? profile.email,
      email: profile.email,
      provider: AUTH_PROVIDERS.GOOGLE,
      providerId: profile.id,
    });

    return {
      token: this.signToken({
        sub: user.id,
        email: user.email,
        role: user.role.name,
      }),
      user,
    };
  }

  async me(userId: string) {
    return this.usersService.findPublicById(userId);
  }

  /** El state se borra al usarlo: sirve una sola vez. */
  private async consumeOAuthState(state?: string) {
    if (!state) {
      throw new BadRequestException('Google OAuth state is required');
    }

    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const stored = await this.redis.get(key);

    if (!stored) {
      throw new UnauthorizedException('Google OAuth state is invalid or expired');
    }

    await this.redis.del(key);
  }

  private signToken(user: JwtUser) {
    const secret = this.configService.get<string>('JWT_SECRET');
    const expiresIn = (this.configService.get<string>('JWT_EXPIRES_IN') ??
      '1d') as SignOptions['expiresIn'];

    if (!secret) {
      throw new BadRequestException('JWT_SECRET is not configured');
    }

    const options: SignOptions = {
      subject: user.sub,
      expiresIn,
    };

    return sign({ email: user.email, role: user.role }, secret, options);
  }
}
