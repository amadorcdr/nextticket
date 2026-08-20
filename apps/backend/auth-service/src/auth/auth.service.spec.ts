/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { decode } from 'jsonwebtoken';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { ActivationService } from '../activation/activation.service';
import { PasswordResetService } from '../password-reset/password-reset.service';
import { AuthService } from './auth.service';
import { AUTH_PROVIDERS } from './auth.constants';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const PASSWORD = 'Test1234';
const JWT_SECRET = 'test-secret';

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    ensureDefaultRoles: jest.fn(),
    ensureDefaultAdmin: jest.fn(),
    createLocalUser: jest.fn(),
    findByEmailForAuth: jest.fn(),
    findPublicById: jest.fn(),
    setPasswordAndActivate: jest.fn(),
    setPassword: jest.fn(),
    upsertOAuthUser: jest.fn(),
  };

  const defaultConfig = (key: string) => {
    if (key === 'JWT_SECRET') return JWT_SECRET;
    if (key === 'JWT_EXPIRES_IN') return '1d';
    if (key === 'GOOGLE_CLIENT_ID') return 'client-id';
    if (key === 'GOOGLE_CLIENT_SECRET') return 'client-secret';
    if (key === 'GOOGLE_CALLBACK_URL')
      return 'http://localhost:3002/auth/google/callback';
    return undefined;
  };

  const config = { get: jest.fn(defaultConfig) };

  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const activation = {
    issueAndSendActivation: jest.fn(),
    consumeToken: jest.fn(),
  };

  const passwordReset = {
    issueAndSendReset: jest.fn(),
    consumeToken: jest.fn(),
    discardToken: jest.fn(),
    notifyPasswordChanged: jest.fn(),
  };

  const publicUser = {
    id: USER_ID,
    name: 'Aidee',
    email: 'aidee@test.com',
    accountStatus: 'PENDING',
    role: { id: 'role-id', name: 'CLIENT' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // clearAllMocks no borra implementaciones: hay que reponerla a mano
    // o el mockReturnValue(undefined) de una prueba contamina las siguientes.
    config.get.mockImplementation(defaultConfig);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: redis },
        { provide: ActivationService, useValue: activation },
        { provide: PasswordResetService, useValue: passwordReset },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('creates the user as PENDING and sends the activation email, without logging in', async () => {
      usersService.createLocalUser.mockResolvedValue(publicUser);

      const result = await service.register({
        name: 'Aidee',
        email: 'aidee@test.com',
      } as never);

      expect(activation.issueAndSendActivation).toHaveBeenCalledWith(publicUser);
      expect(result).not.toHaveProperty('token');
      expect(result.email).toBe('aidee@test.com');
    });
  });

  describe('resendActivation', () => {
    it('resends the activation email for a PENDING account', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(publicUser);

      await service.resendActivation('aidee@test.com');

      expect(activation.issueAndSendActivation).toHaveBeenCalledWith(publicUser);
    });

    it('does nothing (but still answers success) for an unknown email', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(null);

      const result = await service.resendActivation('nadie@test.com');

      expect(activation.issueAndSendActivation).not.toHaveBeenCalled();
      expect(result.message).toEqual(expect.any(String));
    });

    it('does nothing for an already ACTIVE account', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...publicUser,
        accountStatus: 'ACTIVE',
      });

      await service.resendActivation('aidee@test.com');

      expect(activation.issueAndSendActivation).not.toHaveBeenCalled();
    });
  });

  describe('activateAccount', () => {
    it('rejects mismatched passwords before touching the token', async () => {
      await expect(
        service.activateAccount({
          token: 'abc',
          password: PASSWORD,
          confirmPassword: 'otra-cosa',
        } as never),
      ).rejects.toThrow('Las contraseñas no coinciden');

      expect(activation.consumeToken).not.toHaveBeenCalled();
    });

    it('sets the password and activates the account for a valid token', async () => {
      activation.consumeToken.mockResolvedValue({ userId: USER_ID });
      usersService.findPublicById.mockResolvedValue(publicUser);

      const result = await service.activateAccount({
        token: 'abc',
        password: PASSWORD,
        confirmPassword: PASSWORD,
      } as never);

      expect(usersService.setPasswordAndActivate).toHaveBeenCalledWith(
        USER_ID,
        PASSWORD,
      );
      expect(result.message).toEqual(expect.any(String));
    });

    it('refuses to activate an account that is already ACTIVE', async () => {
      activation.consumeToken.mockResolvedValue({ userId: USER_ID });
      usersService.findPublicById.mockResolvedValue({
        ...publicUser,
        accountStatus: 'ACTIVE',
      });

      await expect(
        service.activateAccount({
          token: 'abc',
          password: PASSWORD,
          confirmPassword: PASSWORD,
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(usersService.setPasswordAndActivate).not.toHaveBeenCalled();
    });

    it('propagates an invalid/expired/already-used token as-is', async () => {
      activation.consumeToken.mockRejectedValue(
        new Error('El enlace de activación no es válido o ha expirado.'),
      );

      await expect(
        service.activateAccount({
          token: 'abc',
          password: PASSWORD,
          confirmPassword: PASSWORD,
        } as never),
      ).rejects.toThrow('El enlace de activación no es válido o ha expirado.');
    });
  });

  describe('forgotPassword', () => {
    it('sends a reset email for an active local account and still answers generically', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...publicUser,
        accountStatus: 'ACTIVE',
        provider: 'LOCAL',
      });

      const result = await service.forgotPassword('aidee@test.com');

      expect(passwordReset.issueAndSendReset).toHaveBeenCalledWith(
        expect.objectContaining({ id: USER_ID }),
      );
      expect(result.message).toEqual(expect.any(String));
    });

    it('answers the SAME generic message for an unknown email, without sending anything', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(null);

      const result = await service.forgotPassword('nadie@test.com');

      expect(passwordReset.issueAndSendReset).not.toHaveBeenCalled();
      expect(result.message).toEqual(expect.any(String));
    });

    it('does not send a reset link for an account still PENDING activation', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...publicUser,
        accountStatus: 'PENDING',
        provider: 'LOCAL',
      });

      const result = await service.forgotPassword('aidee@test.com');

      expect(passwordReset.issueAndSendReset).not.toHaveBeenCalled();
      expect(result.message).toEqual(expect.any(String));
    });

    it('does not send a reset link for a Google-only account (no local password to reset)', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        ...publicUser,
        accountStatus: 'ACTIVE',
        provider: 'GOOGLE',
      });

      const result = await service.forgotPassword('aidee@test.com');

      expect(passwordReset.issueAndSendReset).not.toHaveBeenCalled();
      expect(result.message).toEqual(expect.any(String));
    });

    it('gives the exact same response for eligible and non-eligible accounts', async () => {
      usersService.findByEmailForAuth.mockResolvedValue(null);
      const forUnknown = await service.forgotPassword('nadie@test.com');

      usersService.findByEmailForAuth.mockResolvedValue({
        ...publicUser,
        accountStatus: 'ACTIVE',
        provider: 'LOCAL',
      });
      const forKnown = await service.forgotPassword('aidee@test.com');

      expect(forUnknown.message).toBe(forKnown.message);
    });
  });

  describe('discardPasswordReset', () => {
    it('delegates straight to PasswordResetService and answers generically', async () => {
      const result = await service.discardPasswordReset('some-token');

      expect(passwordReset.discardToken).toHaveBeenCalledWith('some-token');
      expect(result.message).toEqual(expect.any(String));
    });
  });

  describe('resetPassword', () => {
    it('rejects mismatched passwords before touching the token', async () => {
      await expect(
        service.resetPassword({
          token: 'abc',
          password: PASSWORD,
          passwordConfirmation: 'otra-cosa',
        } as never),
      ).rejects.toThrow('Las contraseñas no coinciden');

      expect(passwordReset.consumeToken).not.toHaveBeenCalled();
    });

    it('sets the new password, notifies the user and invalidates the token', async () => {
      passwordReset.consumeToken.mockResolvedValue({ userId: USER_ID });
      usersService.setPassword.mockResolvedValue(publicUser);

      const result = await service.resetPassword({
        token: 'abc',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      } as never);

      expect(passwordReset.consumeToken).toHaveBeenCalledWith('abc');
      expect(usersService.setPassword).toHaveBeenCalledWith(USER_ID, PASSWORD);
      expect(passwordReset.notifyPasswordChanged).toHaveBeenCalledWith(publicUser);
      expect(result.message).toEqual(expect.any(String));
    });

    it('propagates an invalid/expired/already-used token as-is', async () => {
      passwordReset.consumeToken.mockRejectedValue(
        new Error('El enlace de recuperación no es válido o ha expirado.'),
      );

      await expect(
        service.resetPassword({
          token: 'abc',
          password: PASSWORD,
          passwordConfirmation: PASSWORD,
        } as never),
      ).rejects.toThrow('El enlace de recuperación no es válido o ha expirado.');

      expect(usersService.setPassword).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token when the password is correct', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        id: USER_ID,
        status: true,
        password: await hash(PASSWORD, 10),
      });
      usersService.findPublicById.mockResolvedValue(publicUser);

      const result = await service.login({
        email: 'aidee@test.com',
        password: PASSWORD,
      } as never);

      expect(result.token).toEqual(expect.any(String));
      expect(result.user).not.toHaveProperty('password');
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        id: USER_ID,
        password: await hash(PASSWORD, 10),
      });

      await expect(
        service.login({ email: 'aidee@test.com', password: 'otra' } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with the SAME message, so no email is leaked', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        id: USER_ID,
        password: await hash(PASSWORD, 10),
      });
      const wrongPassword = await service
        .login({ email: 'aidee@test.com', password: 'otra' } as never)
        .catch((error: Error) => error.message);

      usersService.findByEmailForAuth.mockResolvedValue(null);
      const unknownEmail = await service
        .login({ email: 'nadie@test.com', password: PASSWORD } as never)
        .catch((error: Error) => error.message);

      expect(unknownEmail).toBe(wrongPassword);
    });

    it('rejects a PENDING account (no password set yet) with the same generic message', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        id: USER_ID,
        accountStatus: 'PENDING',
        password: null,
      });

      await expect(
        service.login({ email: 'aidee@test.com', password: PASSWORD } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an OAuth-only account that has no password', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        id: USER_ID,
        password: null,
      });

      await expect(
        service.login({ email: 'aidee@test.com', password: PASSWORD } as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('signToken', () => {
    it('fails loudly when JWT_SECRET is not configured', async () => {
      config.get.mockReturnValue(undefined);
      usersService.findByEmailForAuth.mockResolvedValue({
        id: USER_ID,
        status: true,
        password: await hash(PASSWORD, 10),
      });
      usersService.findPublicById.mockResolvedValue(publicUser);

      await expect(
        service.login({ email: 'aidee@test.com', password: PASSWORD } as never),
      ).rejects.toThrow('JWT_SECRET is not configured');
    });
  });

  describe('google oauth', () => {
    const googleProfile = {
      id: 'google-123',
      email: 'aidee@test.com',
      name: 'Aidee',
      verified_email: true,
    };

    function mockGoogleFetch(profile: Record<string, unknown> = googleProfile) {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ access_token: 'google-access-token' }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => profile }) as never;
    }

    afterEach(() => {
      delete (global as { fetch?: unknown }).fetch;
    });

    it('puts a single-use state in the auth URL and stores it in Redis', async () => {
      const url = await service.getGoogleAuthUrl();
      const state = new URL(url).searchParams.get('state');

      expect(state).toEqual(expect.any(String));
      expect(redis.set).toHaveBeenCalledWith(
        `auth:oauth:state:${state}`,
        expect.anything(),
        600,
      );
    });

    it('rejects a callback without state', async () => {
      await expect(service.handleGoogleCallback('code')).rejects.toThrow(
        'Google OAuth state is required',
      );
    });

    it('rejects a state that Redis does not know', async () => {
      redis.get.mockResolvedValue(null);

      await expect(
        service.handleGoogleCallback('code', 'inventado'),
      ).rejects.toThrow('Google OAuth state is invalid or expired');
    });

    it('consumes the state so it cannot be replayed', async () => {
      redis.get.mockResolvedValue({ createdAt: 'x' });
      usersService.upsertOAuthUser.mockResolvedValue(publicUser);
      mockGoogleFetch();

      await service.handleGoogleCallback('code', 'state-valido');

      expect(redis.del).toHaveBeenCalledWith('auth:oauth:state:state-valido');
    });

    it('links an existing email instead of duplicating the user', async () => {
      redis.get.mockResolvedValue({ createdAt: 'x' });
      usersService.upsertOAuthUser.mockResolvedValue(publicUser);
      mockGoogleFetch();

      const result = await service.handleGoogleCallback('code', 'state-valido');

      expect(usersService.upsertOAuthUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'aidee@test.com',
          provider: AUTH_PROVIDERS.GOOGLE,
          providerId: 'google-123',
        }),
      );
      expect(result.user.id).toBe(USER_ID);
      expect(result.token).toEqual(expect.any(String));
    });

    it('refuses a Google account whose email is not verified', async () => {
      redis.get.mockResolvedValue({ createdAt: 'x' });
      mockGoogleFetch({ ...googleProfile, verified_email: false });

      await expect(
        service.handleGoogleCallback('code', 'state-valido'),
      ).rejects.toThrow('Google email is not verified');
      expect(usersService.upsertOAuthUser).not.toHaveBeenCalled();
    });

    it('refuses to build the Google URL when OAuth is not configured', async () => {
      config.get.mockReturnValue(undefined);

      await expect(service.getGoogleAuthUrl()).rejects.toThrow(
        'Google OAuth is not configured',
      );
    });
  });
});
