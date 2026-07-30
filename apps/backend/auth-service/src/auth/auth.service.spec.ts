/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { decode } from 'jsonwebtoken';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AUTH_PROVIDERS } from './auth.constants';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const PASSWORD = 'Test1234';
const JWT_SECRET = 'test-secret';

describe('AuthService', () => {
  let service: AuthService;

  const usersService = {
    ensureDefaultRoles: jest.fn(),
    createLocalUser: jest.fn(),
    findByEmailForAuth: jest.fn(),
    findPublicById: jest.fn(),
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

  const publicUser = {
    id: USER_ID,
    name: 'Aidee',
    email: 'aidee@test.com',
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('never returns the password and issues a token with sub, email and role', async () => {
      usersService.createLocalUser.mockResolvedValue(publicUser);

      const result = await service.register({
        name: 'Aidee',
        email: 'aidee@test.com',
        password: PASSWORD,
      } as never);

      expect(JSON.stringify(result)).not.toContain(PASSWORD);
      expect(result.user).not.toHaveProperty('password');

      const payload = decode(result.token) as Record<string, unknown>;
      expect(payload).toEqual(
        expect.objectContaining({
          sub: USER_ID,
          email: 'aidee@test.com',
          role: 'CLIENT',
        }),
      );
      expect(payload.exp).toBeDefined();
    });

    it('delegates hashing to UsersService instead of storing plain text', async () => {
      usersService.createLocalUser.mockResolvedValue(publicUser);

      await service.register({
        name: 'Aidee',
        email: 'aidee@test.com',
        password: PASSWORD,
      } as never);

      // El DTO llega tal cual; el hash lo aplica UsersService con bcrypt.
      const [dto] = usersService.createLocalUser.mock.calls[0];
      expect(dto.password).toBe(PASSWORD);
    });
  });

  describe('login', () => {
    it('returns a token when the password is correct', async () => {
      usersService.findByEmailForAuth.mockResolvedValue({
        id: USER_ID,
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
      usersService.createLocalUser.mockResolvedValue(publicUser);

      await expect(
        service.register({
          name: 'Aidee',
          email: 'aidee@test.com',
          password: PASSWORD,
        } as never),
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
