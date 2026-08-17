import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;

  const prisma = {
    ticket: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const config = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  describe('getStats', () => {
    it('returns total sold and counts grouped by event zone', async () => {
      redis.get.mockResolvedValueOnce(null);
      prisma.ticket.count.mockResolvedValueOnce(18560);
      prisma.ticket.groupBy.mockResolvedValueOnce([
        { eventZoneId: 'zone-1', _count: 850 },
        { eventZoneId: 'zone-2', _count: 320 },
      ]);

      await expect(service.getStats()).resolves.toEqual({
        totalSold: 18560,
        byEventZone: [
          { eventZoneId: 'zone-1', count: 850 },
          { eventZoneId: 'zone-2', count: 320 },
        ],
      });

      expect(redis.set).toHaveBeenCalledWith(
        'tickets:stats',
        {
          totalSold: 18560,
          byEventZone: [
            { eventZoneId: 'zone-1', count: 850 },
            { eventZoneId: 'zone-2', count: 320 },
          ],
        },
        30,
      );
    });

    it('excludes canceled tickets from the counts', async () => {
      redis.get.mockResolvedValueOnce(null);
      prisma.ticket.count.mockResolvedValueOnce(0);
      prisma.ticket.groupBy.mockResolvedValueOnce([]);

      await service.getStats();

      expect(prisma.ticket.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { not: 'CANCELED' } },
        }),
      );
      expect(prisma.ticket.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['eventZoneId'],
          where: { status: { not: 'CANCELED' } },
        }),
      );
    });

    it('returns the cached value without touching the database', async () => {
      redis.get.mockResolvedValueOnce({ totalSold: 5, byEventZone: [] });

      await expect(service.getStats()).resolves.toEqual({
        totalSold: 5,
        byEventZone: [],
      });

      expect(prisma.ticket.count).not.toHaveBeenCalled();
      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
    });
  });

  describe('issueForPurchase', () => {
    const DTO = {
      purchaseId: 'purchase-1',
      purchaseDetailId: 'detail-1',
      currentHolderId: 'user-1',
      eventZoneId: 'zone-1',
      eventSeatId: 'seat-1',
    };

    it('issues a new ISSUED ticket with a generated folio and qrCode', async () => {
      prisma.ticket.findFirst.mockResolvedValueOnce(null);
      prisma.ticket.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'ticket-1', ...data }),
      );

      const result = await service.issueForPurchase(DTO);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'ticket-1',
          purchaseDetailId: 'detail-1',
          currentHolderId: 'user-1',
          originType: 'PURCHASE',
          status: 'ISSUED',
          folio: expect.any(String),
          qrCode: expect.any(String),
        }),
      );
      expect(redis.del).toHaveBeenCalledWith('tickets:list');
      expect(redis.del).toHaveBeenCalledWith('tickets:stats');
    });

    it('is idempotent: returns the existing ticket instead of creating a duplicate', async () => {
      prisma.ticket.findFirst.mockResolvedValueOnce({
        id: 'existing-ticket',
        purchaseDetailId: 'detail-1',
      });

      const result = await service.issueForPurchase(DTO);

      expect(result).toEqual(
        expect.objectContaining({ id: 'existing-ticket' }),
      );
      expect(prisma.ticket.create).not.toHaveBeenCalled();
    });

    it('recovers the winning ticket when two concurrent calls race on the unique constraint', async () => {
      prisma.ticket.findFirst
        .mockResolvedValueOnce(null) // no existe todavía en el pre-check
        .mockResolvedValueOnce({ id: 'race-winner', purchaseDetailId: 'detail-1' }); // recuperado tras P2002

      prisma.ticket.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      const result = await service.issueForPurchase(DTO);

      expect(result).toEqual(expect.objectContaining({ id: 'race-winner' }));
    });
  });

  describe('getStatsByEventZones', () => {
    it('aggregates counts by status, per zone and overall', async () => {
      prisma.ticket.groupBy.mockResolvedValueOnce([
        { eventZoneId: 'zone-1', status: 'USED', _count: 400 },
        { eventZoneId: 'zone-1', status: 'ISSUED', _count: 250 },
        { eventZoneId: 'zone-1', status: 'CANCELED', _count: 50 },
        { eventZoneId: 'zone-2', status: 'EXPIRED', _count: 30 },
        { eventZoneId: 'zone-2', status: 'USED', _count: 20 },
      ]);

      await expect(
        service.getStatsByEventZones(['zone-1', 'zone-2']),
      ).resolves.toEqual({
        total: 750,
        sold: 700,
        validated: 420,
        unvalidated: 280,
        canceled: 50,
        byEventZone: [
          { eventZoneId: 'zone-1', total: 700, sold: 650, validated: 400, unvalidated: 250, canceled: 50 },
          { eventZoneId: 'zone-2', total: 50, sold: 50, validated: 20, unvalidated: 30, canceled: 0 },
        ],
      });

      expect(prisma.ticket.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['eventZoneId', 'status'],
          where: { eventZoneId: { in: ['zone-1', 'zone-2'] } },
        }),
      );
    });

    it('returns zeroed stats without querying when there are no zones', async () => {
      await expect(service.getStatsByEventZones([])).resolves.toEqual({
        total: 0,
        sold: 0,
        validated: 0,
        unvalidated: 0,
        canceled: 0,
        byEventZone: [],
      });

      expect(prisma.ticket.groupBy).not.toHaveBeenCalled();
    });

    it('includes zones with zero tickets in the breakdown', async () => {
      prisma.ticket.groupBy.mockResolvedValueOnce([]);

      await expect(
        service.getStatsByEventZones(['zone-empty']),
      ).resolves.toEqual({
        total: 0,
        sold: 0,
        validated: 0,
        unvalidated: 0,
        canceled: 0,
        byEventZone: [
          { eventZoneId: 'zone-empty', total: 0, sold: 0, validated: 0, unvalidated: 0, canceled: 0 },
        ],
      });
    });
  });
});
