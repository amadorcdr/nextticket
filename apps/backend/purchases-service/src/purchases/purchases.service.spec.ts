/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SimulatedPaymentMethod } from './dto/create-purchase.dto';
import { PurchasesService } from './purchases.service';

describe('PurchasesService', () => {
  let service: PurchasesService;
  const prisma = {
    temporaryBlock: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    purchase: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    setIfAbsent: jest.fn(),
    ttl: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);
  });

  it('creates a temporary block using Redis NX lock', async () => {
    redis.setIfAbsent.mockResolvedValue(true);
    prisma.temporaryBlock.create.mockResolvedValue({ id: 'block-id' });

    await expect(
      service.createTemporaryBlock({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
        eventSeatId: '550e8400-e29b-41d4-a716-446655440002',
        quantity: 5,
      }),
    ).resolves.toEqual({ id: 'block-id' });

    expect(redis.setIfAbsent).toHaveBeenCalledWith(
      'event-zone:550e8400-e29b-41d4-a716-446655440001:seat:550e8400-e29b-41d4-a716-446655440002',
      expect.objectContaining({ quantity: 1 }),
      480,
    );
    expect(prisma.temporaryBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 1 }),
      }),
    );
  });

  it('rejects a temporary block when Redis lock already exists', async () => {
    redis.setIfAbsent.mockResolvedValue(false);

    await expect(
      service.createTemporaryBlock({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
        eventSeatId: '550e8400-e29b-41d4-a716-446655440002',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a confirmed purchase with details and approved payment', async () => {
    prisma.temporaryBlock.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1000) }]),
        purchase: {
          create: jest.fn().mockResolvedValue({
            id: 'purchase-id',
            total: '100.00',
            payments: [{ status: 'APPROVED' }],
          }),
        },
      }),
    );

    const result = await service.create({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      eventId: '550e8400-e29b-41d4-a716-446655440010',
      details: [
        {
          eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
          unitPrice: 100,
          discountAmount: 10,
          taxAmount: 14.4,
        },
      ],
      payment: {
        paymentMethod: SimulatedPaymentMethod.CREDIT_CARD,
        cardholderName: 'QA APPROVED',
        cardNumber: '4242424242424242',
        expirationMonth: 12,
        expirationYear: 2030,
        cvv: '123',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        paymentResult: expect.objectContaining({ approved: true }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('purchases:list');
  });

  it('stores a canceled purchase when simulated card is declined', async () => {
    prisma.temporaryBlock.updateMany.mockResolvedValue({ count: 0 });
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        purchase: {
          create: jest.fn().mockResolvedValue({
            id: 'purchase-id',
            payments: [{ status: 'REJECTED' }],
          }),
        },
      }),
    );

    const result = await service.create({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      eventId: '550e8400-e29b-41d4-a716-446655440010',
      details: [
        {
          eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
          unitPrice: 100,
        },
      ],
      payment: {
        paymentMethod: SimulatedPaymentMethod.CREDIT_CARD,
        cardholderName: 'QA DECLINED',
        cardNumber: '4000000000000000',
        expirationMonth: 12,
        expirationYear: 2030,
        cvv: '123',
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        paymentResult: expect.objectContaining({ approved: false }),
      }),
    );
  });
});
