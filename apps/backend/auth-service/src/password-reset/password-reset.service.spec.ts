/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { PasswordResetService } from './password-reset.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('PasswordResetService', () => {
  let service: PasswordResetService;

  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const mail = { send: jest.fn() };

  const defaultConfig = (key: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:4000';
    if (key === 'PASSWORD_RESET_TOKEN_TTL_MINUTES') return '60';
    return undefined;
  };
  const config = { get: jest.fn(defaultConfig) };

  const user = { id: USER_ID, name: 'Aidee', email: 'aidee@test.com' };

  beforeEach(async () => {
    jest.clearAllMocks();
    config.get.mockImplementation(defaultConfig);
    redis.get.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetService,
        { provide: RedisService, useValue: redis },
        { provide: MailService, useValue: mail },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<PasswordResetService>(PasswordResetService);
  });

  describe('issueAndSendReset', () => {
    it('stores the token under its own prefix, distinct from activation tokens', async () => {
      await service.issueAndSendReset(user);

      const [key] = redis.set.mock.calls[0];
      expect(key).toMatch(/^auth:password-reset:token:/);
      expect(key).not.toMatch(/^auth:activation:token:/);
    });

    it('sends an email containing the reset link built from FRONTEND_URL', async () => {
      await service.issueAndSendReset(user);

      const [to, subject, html, text] = mail.send.mock.calls[0];
      expect(to).toBe(user.email);
      expect(subject).toMatch(/contraseña/i);
      expect(html).toContain('http://localhost:4000/reset-password?token=');
      expect(text).toContain('http://localhost:4000/reset-password?token=');
    });

    it('never embeds an actual password value in the email, only the link', async () => {
      await service.issueAndSendReset(user);

      const [, , html, text] = mail.send.mock.calls[0];
      expect(html).not.toMatch(/contraseña:\s*\S/i);
      expect(text).not.toMatch(/contraseña:\s*\S/i);
    });

    it('invalidates a previous still-valid token when a new one is requested', async () => {
      redis.get.mockResolvedValueOnce('old-token-123'); // user index lookup

      await service.issueAndSendReset(user);

      expect(redis.del).toHaveBeenCalledWith('auth:password-reset:token:old-token-123');
    });

    it('does not try to invalidate anything when there is no previous token', async () => {
      redis.get.mockResolvedValueOnce(null);

      await service.issueAndSendReset(user);

      expect(redis.del).not.toHaveBeenCalled();
    });

    it('surfaces a mail failure instead of silently pretending it worked', async () => {
      mail.send.mockRejectedValue(new Error('smtp down'));

      await expect(service.issueAndSendReset(user)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('fails loudly when FRONTEND_URL is not configured, instead of hardcoding a domain', async () => {
      config.get.mockImplementation((key: string) =>
        key === 'FRONTEND_URL' ? undefined : defaultConfig(key),
      );

      await expect(service.issueAndSendReset(user)).rejects.toThrow(
        'FRONTEND_URL no está configurado',
      );
    });
  });

  describe('consumeToken', () => {
    it('resolves the userId for a valid token and deletes it (one-time use)', async () => {
      redis.get.mockResolvedValueOnce({ userId: USER_ID });

      const result = await service.consumeToken('valid-token');

      expect(result).toEqual({ userId: USER_ID });
      expect(redis.del).toHaveBeenCalledWith('auth:password-reset:token:valid-token');
      expect(redis.del).toHaveBeenCalledWith(`auth:password-reset:user:${USER_ID}`);
    });

    it('rejects a missing/expired/already-used token', async () => {
      redis.get.mockResolvedValueOnce(null);

      await expect(service.consumeToken('gone')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cannot be consumed twice: the second read finds nothing', async () => {
      redis.get.mockResolvedValueOnce({ userId: USER_ID }).mockResolvedValueOnce(null);

      await service.consumeToken('one-shot');
      await expect(service.consumeToken('one-shot')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('discardToken', () => {
    it('deletes both the token and its user index without leaking whether it was valid', async () => {
      redis.get.mockResolvedValueOnce({ userId: USER_ID });

      await service.discardToken('some-token');

      expect(redis.del).toHaveBeenCalledWith('auth:password-reset:token:some-token');
      expect(redis.del).toHaveBeenCalledWith(`auth:password-reset:user:${USER_ID}`);
    });

    it('resolves silently even for a token that never existed', async () => {
      redis.get.mockResolvedValueOnce(null);

      await expect(service.discardToken('nunca-existio')).resolves.toBeUndefined();
    });
  });

  describe('notifyPasswordChanged', () => {
    it('sends an informative email with no password inside', async () => {
      await service.notifyPasswordChanged(user);

      const [to, subject, html, text] = mail.send.mock.calls[0];
      expect(to).toBe(user.email);
      expect(subject).toMatch(/modificada|contraseña/i);
      expect(html.toLowerCase()).not.toMatch(/nueva contraseña:|password:/);
      expect(text.toLowerCase()).not.toMatch(/nueva contraseña:|password:/);
    });

    it('does not throw when the notification email fails to send', async () => {
      mail.send.mockRejectedValue(new Error('smtp down'));

      await expect(service.notifyPasswordChanged(user)).resolves.toBeUndefined();
    });
  });
});
