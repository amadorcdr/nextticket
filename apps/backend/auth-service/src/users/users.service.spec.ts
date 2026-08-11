/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UsersService } from './users.service';

const PASSWORD = 'Test1234';

describe('UsersService', () => {
  let service: UsersService;

  const prisma = {
    user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    role: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.role.findUnique.mockResolvedValue({ id: 'role-id', name: 'CLIENT' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('stores the password hashed with bcrypt, never in plain text', async () => {
    prisma.user.create.mockResolvedValue({ id: 'user-id' });

    await service.createLocalUser({
      name: 'Aidee',
      email: 'aidee@test.com',
      password: PASSWORD,
    } as never);

    const [{ data }] = prisma.user.create.mock.calls[0];
    expect(data.password).not.toBe(PASSWORD);
    expect(data.password.startsWith('$2')).toBe(true);
    await expect(compare(PASSWORD, data.password)).resolves.toBe(true);
  });

  it('never selects the password column back', async () => {
    prisma.user.create.mockResolvedValue({ id: 'user-id' });

    await service.createLocalUser({
      name: 'Aidee',
      email: 'aidee@test.com',
      password: PASSWORD,
    } as never);

    const [{ select }] = prisma.user.create.mock.calls[0];
    expect(select).not.toHaveProperty('password');
  });

  it('turns a duplicated email into 409 instead of a Prisma 500', async () => {
    prisma.user.create.mockRejectedValue(
      Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['email'] },
      }),
    );

    await expect(
      service.createLocalUser({
        name: 'Aidee',
        email: 'aidee@test.com',
        password: PASSWORD,
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets any other database error bubble up untouched', async () => {
    prisma.user.create.mockRejectedValue(
      Object.assign(new Error('connection lost'), { code: 'P1001' }),
    );

    await expect(
      service.createLocalUser({
        name: 'Aidee',
        email: 'aidee@test.com',
        password: PASSWORD,
      } as never),
    ).rejects.toThrow('connection lost');
  });

  it('links an OAuth login to the existing account with the same email', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-id',
      roleId: 'role-id',
    });
    prisma.user.update.mockResolvedValue({ id: 'user-id' });

    await service.upsertOAuthUser({
      name: 'Aidee',
      email: 'aidee@test.com',
      provider: 'GOOGLE',
      providerId: 'google-123',
    });

    // Actualiza, no crea: el usuario no se duplica.
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates an OAuth user with no password when the email is new', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({ id: 'user-id' });

    await service.upsertOAuthUser({
      name: 'Aidee',
      email: 'nueva@test.com',
      provider: 'GOOGLE',
      providerId: 'google-456',
    });

    const [{ data }] = prisma.user.create.mock.calls[0];
    expect(data.password).toBeNull();
    expect(data.provider).toBe('GOOGLE');
  });
});
