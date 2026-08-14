/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SimulatedPaymentMethod } from './dto/create-purchase.dto';
import { PurchasesGateway } from './purchases.gateway';
import { PurchasesService } from './purchases.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const ADMIN_USER = { sub: USER_ID, email: 'admin@test.com', role: 'ADMIN' as const };

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
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    purchaseDetail: {
      groupBy: jest.fn(),
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
  const gateway = {
    emitBlockLocked: jest.fn(),
    emitBlockReleased: jest.fn(),
    emitBlockExpired: jest.fn(),
    emitBlockConverted: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.temporaryBlock.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: PurchasesGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);
  });

  it('creates a temporary block using Redis NX lock', async () => {
    redis.setIfAbsent.mockResolvedValue(true);
    prisma.temporaryBlock.create.mockResolvedValue({ id: 'block-id' });

    await expect(
      service.createTemporaryBlock(
        {
          eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
          eventSeatId: '550e8400-e29b-41d4-a716-446655440002',
        },
        USER_ID,
      ),
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

  it('rejects a seat block asking for more than one place', async () => {
    await expect(
      service.createTemporaryBlock(
        {
          eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
          eventSeatId: '550e8400-e29b-41d4-a716-446655440002',
          quantity: 5,
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // The request is rejected before taking the lock, so no lock is leaked.
    expect(redis.setIfAbsent).not.toHaveBeenCalled();
    expect(prisma.temporaryBlock.create).not.toHaveBeenCalled();
  });

  it('rejects a temporary block when Redis lock already exists', async () => {
    redis.setIfAbsent.mockResolvedValue(false);

    await expect(
      service.createTemporaryBlock(
        {
          eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
          eventSeatId: '550e8400-e29b-41d4-a716-446655440002',
        },
        USER_ID,
      ),
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

    const result = await service.create(
      {
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
      },
      USER_ID,
    );

    expect(result).toEqual(
      expect.objectContaining({
        paymentResult: expect.objectContaining({ approved: true }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('purchases:list');
  });

  it('refuses to update a purchase that belongs to somebody else', async () => {
    prisma.purchase.findUnique.mockResolvedValue({
      id: 'purchase-id',
      userId: 'otro-usuario',
    });

    await expect(
      service.update('purchase-id', { status: undefined }, USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.purchase.update).not.toHaveBeenCalled();
  });

  it('refuses to cancel a purchase that belongs to somebody else', async () => {
    prisma.purchase.findUnique.mockResolvedValue({
      id: 'purchase-id',
      userId: 'otro-usuario',
    });

    await expect(service.remove('purchase-id', USER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.purchase.update).not.toHaveBeenCalled();
  });

  it('lets the owner cancel their own purchase', async () => {
    prisma.purchase.findUnique.mockResolvedValue({
      id: 'purchase-id',
      userId: USER_ID,
      eventId: '550e8400-e29b-41d4-a716-446655440010',
    });
    prisma.purchase.update.mockResolvedValue({ id: 'purchase-id' });

    await expect(service.remove('purchase-id', USER_ID)).resolves.toEqual({
      canceled: true,
    });
    expect(prisma.purchase.update).toHaveBeenCalledWith({
      where: { id: 'purchase-id' },
      data: { status: 'CANCELED' },
    });
    expect(redis.del).toHaveBeenCalledWith(
      'purchases:stats:event:550e8400-e29b-41d4-a716-446655440010',
    );
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

    const result = await service.create(
      {
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
      },
      USER_ID,
    );

    expect(result).toEqual(
      expect.objectContaining({
        paymentResult: expect.objectContaining({ approved: false }),
      }),
    );
  });

  describe('getStats', () => {
    it('sums confirmed revenue and counts recent purchases', async () => {
      redis.get.mockResolvedValueOnce(null);
      prisma.purchase.aggregate.mockResolvedValueOnce({ _sum: { total: '3420500.00' } });
      prisma.purchase.count.mockResolvedValueOnce(37);

      await expect(service.getStats(ADMIN_USER)).resolves.toEqual({
        totalRevenue: 3420500,
        recentPurchasesCount: 37,
      });

      expect(redis.set).toHaveBeenCalledWith(
        'purchases:stats',
        { totalRevenue: 3420500, recentPurchasesCount: 37 },
        30,
      );
      expect(prisma.purchaseDetail.groupBy).not.toHaveBeenCalled();
    });

    it('returns zero revenue when there are no confirmed purchases', async () => {
      redis.get.mockResolvedValueOnce(null);
      prisma.purchase.aggregate.mockResolvedValueOnce({ _sum: { total: null } });
      prisma.purchase.count.mockResolvedValueOnce(0);

      await expect(service.getStats(ADMIN_USER)).resolves.toEqual({
        totalRevenue: 0,
        recentPurchasesCount: 0,
      });
    });

    it('returns the cached value without touching the database', async () => {
      redis.get.mockResolvedValueOnce({
        totalRevenue: 999,
        recentPurchasesCount: 1,
      });

      await expect(service.getStats(ADMIN_USER)).resolves.toEqual({
        totalRevenue: 999,
        recentPurchasesCount: 1,
      });

      expect(prisma.purchase.aggregate).not.toHaveBeenCalled();
    });

    it('filters revenue and recent count by eventId, and includes zone breakdown', async () => {
      const eventId = '550e8400-e29b-41d4-a716-446655440010';
      redis.get.mockResolvedValueOnce(null);
      prisma.purchase.aggregate.mockResolvedValueOnce({ _sum: { total: '1500.00' } });
      prisma.purchase.count.mockResolvedValueOnce(3);
      prisma.purchaseDetail.groupBy.mockResolvedValueOnce([
        { eventZoneId: 'zone-1', _sum: { finalPrice: '1000.00', taxAmount: '160.00' } },
        { eventZoneId: 'zone-2', _sum: { finalPrice: '500.00', taxAmount: '80.00' } },
      ]);

      await expect(service.getStats(ADMIN_USER, eventId)).resolves.toEqual({
        totalRevenue: 1500,
        recentPurchasesCount: 3,
        byEventZone: [
          { eventZoneId: 'zone-1', revenue: 1160 },
          { eventZoneId: 'zone-2', revenue: 580 },
        ],
      });

      expect(prisma.purchase.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'CONFIRMED', eventId }),
        }),
      );
      expect(prisma.purchaseDetail.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['eventZoneId'],
          where: { purchase: { eventId, status: 'CONFIRMED' } },
        }),
      );
      expect(redis.set).toHaveBeenCalledWith(
        `purchases:stats:event:${eventId}`,
        expect.objectContaining({ totalRevenue: 1500 }),
        30,
      );
    });
  });

  describe('findAll eventId filter', () => {
    it('filters by eventId and skips the cache', async () => {
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(
        { page: 1, limit: 20 },
        { sub: USER_ID, email: 'admin@test.com', role: 'ADMIN' },
        '550e8400-e29b-41d4-a716-446655440010',
      );

      expect(redis.get).not.toHaveBeenCalled();
      expect(prisma.purchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventId: '550e8400-e29b-41d4-a716-446655440010' },
        }),
      );
    });
  });

  describe('ORGANIZER access to their own event (assertOrganizerOwnsEvent)', () => {
    const EVENT_ID = '550e8400-e29b-41d4-a716-446655440010';
    const ORGANIZER_ID = '550e8400-e29b-41d4-a716-446655440099';
    const ORGANIZER = { sub: ORGANIZER_ID, email: 'org@test.com', role: 'ORGANIZER' as const };

    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
      fetchSpy = jest.spyOn(global, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('getStats rejects an ORGANIZER that does not send eventId', async () => {
      await expect(service.getStats(ORGANIZER)).rejects.toThrow(ForbiddenException);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('getStats rejects an ORGANIZER querying an event that is not theirs', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ organizerId: 'someone-else' }),
      } as Response);

      await expect(service.getStats(ORGANIZER, EVENT_ID)).rejects.toThrow(ForbiddenException);
    });

    it('getStats allows an ORGANIZER querying their own event', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ organizerId: ORGANIZER_ID }),
      } as Response);
      redis.get.mockResolvedValueOnce(null);
      prisma.purchase.aggregate.mockResolvedValueOnce({ _sum: { total: '100.00' } });
      prisma.purchase.count.mockResolvedValueOnce(1);
      prisma.purchaseDetail.groupBy.mockResolvedValueOnce([]);

      await expect(service.getStats(ORGANIZER, EVENT_ID)).resolves.toEqual(
        expect.objectContaining({ totalRevenue: 100 }),
      );
    });

    it('getStats reports the event as not found when venues-events-service 404s', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response);

      await expect(service.getStats(ORGANIZER, EVENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('findAll lets an ORGANIZER see every purchase of their own event, not just their own', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ organizerId: ORGANIZER_ID }),
      } as Response);
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll({ page: 1, limit: 20 }, ORGANIZER, EVENT_ID);

      expect(prisma.purchase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { eventId: EVENT_ID } }),
      );
    });

    it('findAll rejects an ORGANIZER trying to list purchases of an event that is not theirs', async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ organizerId: 'someone-else' }),
      } as Response);

      await expect(service.findAll({ page: 1, limit: 20 }, ORGANIZER, EVENT_ID)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.purchase.findMany).not.toHaveBeenCalled();
    });
  });
});
