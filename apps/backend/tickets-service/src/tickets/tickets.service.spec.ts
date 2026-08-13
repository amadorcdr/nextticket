import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;

  const prisma = {
    ticket: {
      count: jest.fn(),
      groupBy: jest.fn(),
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
});
