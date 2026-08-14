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
    acquireMultiLock: jest.fn(),
    ttl: jest.fn(),
    del: jest.fn(),
    delMany: jest.fn(),
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
    // Por defecto el usuario SÍ tiene turno vigente en la fila virtual; los
    // tests que necesitan probar el caso contrario lo sobreescriben.
    redis.get.mockResolvedValue({ queueEntryId: 'entry-1', userId: USER_ID });

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

  it('creates a temporary block using Redis NX lock (general admission)', async () => {
    redis.setIfAbsent.mockResolvedValue(true);
    prisma.temporaryBlock.create.mockResolvedValue({
      id: 'block-id',
      eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
      eventSeatId: null,
      quantity: 1,
    });

    const result = await service.createTemporaryBlock(
      {
        eventId: '550e8400-e29b-41d4-a716-446655440010',
        eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
      },
      USER_ID,
    );

    expect(result).toEqual(
      expect.objectContaining({
        status: 'HELD',
        blocks: [expect.objectContaining({ blockId: 'block-id' })],
      }),
    );
    expect(redis.setIfAbsent).toHaveBeenCalledWith(
      'event-zone:550e8400-e29b-41d4-a716-446655440001:general-admission',
      expect.objectContaining({ quantity: 1 }),
      480,
    );
    expect(prisma.temporaryBlock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 1 }),
      }),
    );
  });

  it('rejects a hold when the user has no active admission from the virtual queue', async () => {
    redis.get.mockResolvedValueOnce(null);

    await expect(
      service.createTemporaryBlock(
        {
          eventId: '550e8400-e29b-41d4-a716-446655440010',
          eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Se rechaza antes de tocar el lock: no se filtra ningún lock huérfano.
    expect(redis.setIfAbsent).not.toHaveBeenCalled();
    expect(prisma.temporaryBlock.create).not.toHaveBeenCalled();
  });

  it('rejects a temporary block when Redis lock already exists', async () => {
    redis.setIfAbsent.mockResolvedValue(false);

    await expect(
      service.createTemporaryBlock(
        {
          eventId: '550e8400-e29b-41d4-a716-446655440010',
          eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
        },
        USER_ID,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('reserved seat holds (atomic multi-seat)', () => {
    const ZONE_ID = '550e8400-e29b-41d4-a716-446655440001';
    let fetchSpy: jest.SpyInstance;

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    it('blocks multiple seats atomically after validating them against venues-events-service', async () => {
      const seatA = '550e8400-e29b-41d4-a716-446655440002';
      const seatB = '550e8400-e29b-41d4-a716-446655440003';
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: seatA, eventZoneId: ZONE_ID, status: 'AVAILABLE' },
          { id: seatB, eventZoneId: ZONE_ID, status: 'AVAILABLE' },
        ],
      } as Response);
      redis.acquireMultiLock.mockResolvedValue(true);
      prisma.$transaction.mockResolvedValue([
        { id: 'block-a', eventZoneId: ZONE_ID, eventSeatId: seatA, quantity: 1 },
        { id: 'block-b', eventZoneId: ZONE_ID, eventSeatId: seatB, quantity: 1 },
      ]);

      const result = await service.createTemporaryBlock(
        {
          eventId: '550e8400-e29b-41d4-a716-446655440010',
          eventZoneId: ZONE_ID,
          eventSeatIds: [seatA, seatB],
        },
        USER_ID,
      );

      expect(result.blocks).toHaveLength(2);
      expect(redis.acquireMultiLock).toHaveBeenCalledWith(
        [`event-zone:${ZONE_ID}:seat:${seatA}`, `event-zone:${ZONE_ID}:seat:${seatB}`],
        480,
        expect.any(Array),
      );
    });

    it('rejects the whole hold, without touching Redis, when one seat is not AVAILABLE', async () => {
      const seatA = '550e8400-e29b-41d4-a716-446655440002';
      const seatB = '550e8400-e29b-41d4-a716-446655440003';
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { id: seatA, eventZoneId: ZONE_ID, status: 'AVAILABLE' },
          { id: seatB, eventZoneId: ZONE_ID, status: 'SOLD' },
        ],
      } as Response);

      await expect(
        service.createTemporaryBlock(
          {
            eventId: '550e8400-e29b-41d4-a716-446655440010',
            eventZoneId: ZONE_ID,
            eventSeatIds: [seatA, seatB],
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(redis.acquireMultiLock).not.toHaveBeenCalled();
    });

    it('rejects when a requested seat id does not exist for the event', async () => {
      const seatA = '550e8400-e29b-41d4-a716-446655440002';
      fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
      } as Response);

      await expect(
        service.createTemporaryBlock(
          {
            eventId: '550e8400-e29b-41d4-a716-446655440010',
            eventZoneId: ZONE_ID,
            eventSeatIds: [seatA],
          },
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('releaseTemporaryBlock ownership', () => {
    it("rejects releasing another user's temporary block", async () => {
      prisma.temporaryBlock.findUnique.mockResolvedValue({
        id: 'block-1',
        userId: 'otro-usuario',
        eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
        eventSeatId: null,
      });

      await expect(service.releaseTemporaryBlock('block-1', USER_ID)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('create — confirmed purchase', () => {
    let fetchSpy: jest.SpyInstance;
    let purchaseCreateMock: jest.Mock;

    beforeEach(() => {
      purchaseCreateMock = jest.fn().mockResolvedValue({
        id: 'purchase-id',
        userId: USER_ID,
        total: '100.00',
        payments: [{ status: 'APPROVED' }],
        details: [
          {
            id: 'detail-1',
            eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
            eventSeatId: null,
          },
        ],
      });
      prisma.temporaryBlock.updateMany.mockResolvedValue({ count: 0 });
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          $queryRaw: jest.fn().mockResolvedValue([{ nextval: BigInt(1000) }]),
          purchase: { create: purchaseCreateMock },
        }),
      );
    });

    afterEach(() => {
      fetchSpy?.mockRestore();
    });

    const CREATE_DTO = {
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
    };

    const mockEventWithZonePrice = (price: number) =>
      ({
        ok: true,
        status: 200,
        json: async () => ({
          zones: [
            { id: '550e8400-e29b-41d4-a716-446655440001', eventPrice: String(price) },
          ],
        }),
      }) as Response;

    it('confirms the purchase and issues one ticket per detail via tickets-service', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/tickets/internal/issue-for-purchase')) {
          return { ok: true, status: 201, json: async () => ({ id: 'ticket-1', folio: 'TK-ABC123' }) } as Response;
        }
        return mockEventWithZonePrice(100);
      });

      const result = await service.create(CREATE_DTO, USER_ID);

      expect(result).toEqual(
        expect.objectContaining({
          paymentResult: expect.objectContaining({ approved: true }),
          tickets: [{ id: 'ticket-1', folio: 'TK-ABC123' }],
        }),
      );
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('purchases:list');
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/tickets/internal/issue-for-purchase'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Internal-Service-Token': expect.any(String),
          }),
        }),
      );
    });

    it('does not fail the purchase when ticket issuance fails, but returns no tickets', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/tickets/internal/issue-for-purchase')) {
          return { ok: false, status: 500 } as Response;
        }
        return mockEventWithZonePrice(100);
      });

      const result = await service.create(CREATE_DTO, USER_ID);

      expect(result).toEqual(
        expect.objectContaining({
          paymentResult: expect.objectContaining({ approved: true }),
          tickets: [],
        }),
      );
    });

    it('uses the authoritative zone price from venues-events-service, not the client-sent unitPrice', async () => {
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/tickets/internal/issue-for-purchase')) {
          return { ok: true, status: 201, json: async () => ({ id: 'ticket-1' }) } as Response;
        }
        return mockEventWithZonePrice(9999); // precio real muy distinto al que manda el cliente (100)
      });

      await service.create(CREATE_DTO, USER_ID);

      expect(purchaseCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            details: {
              create: [expect.objectContaining({ unitPrice: 9999 })],
            },
          }),
        }),
      );
    });

    it('rejects confirming the purchase when a seat is no longer AVAILABLE (revalidación final anti-sobreventa)', async () => {
      const seatId = '550e8400-e29b-41d4-a716-446655440002';
      fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes('/seats/by-event-seat-ids')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { id: seatId, eventZoneId: '550e8400-e29b-41d4-a716-446655440001', status: 'SOLD' },
            ],
          } as Response;
        }
        return mockEventWithZonePrice(100);
      });

      const dtoWithSeat = {
        ...CREATE_DTO,
        details: [{ ...CREATE_DTO.details[0], eventSeatId: seatId }],
      };

      await expect(service.create(dtoWithSeat, USER_ID)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
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
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        zones: [
          { id: '550e8400-e29b-41d4-a716-446655440001', eventPrice: '100' },
        ],
      }),
    } as Response);

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
    fetchSpy.mockRestore();
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
