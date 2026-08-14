import { Test, TestingModule } from '@nestjs/testing';
import { EventSeatStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventSeatService } from './event-seat.service';

const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('EventSeatService', () => {
  let service: EventSeatService;

  const prisma = {
    event: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const redis = { del: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.event.findUnique.mockResolvedValue({ id: EVENT_ID });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSeatService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<EventSeatService>(EventSeatService);
  });

  describe('markSoldForPurchase', () => {
    it('marks AVAILABLE seats as SOLD and decrements zone capacity once per seat', async () => {
      const eventSeatUpdate = jest.fn();
      const eventZoneUpdate = jest.fn();
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          eventSeat: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'seat-1', status: EventSeatStatus.AVAILABLE, eventZoneId: 'zone-1' },
              { id: 'seat-2', status: EventSeatStatus.AVAILABLE, eventZoneId: 'zone-1' },
            ]),
            update: eventSeatUpdate,
          },
          eventZone: { update: eventZoneUpdate },
        }),
      );

      const result = await service.markSoldForPurchase(EVENT_ID, ['seat-1', 'seat-2']);

      expect(result).toEqual({ updated: 2, requested: 2 });
      expect(eventSeatUpdate).toHaveBeenCalledTimes(2);
      expect(eventSeatUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'seat-1' },
          data: { status: EventSeatStatus.SOLD },
        }),
      );
      expect(eventZoneUpdate).toHaveBeenCalledTimes(2);
      expect(eventZoneUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'zone-1' },
          data: { availableCapacity: { decrement: 1 } },
        }),
      );
      expect(redis.del).toHaveBeenCalled();
    });

    it('is idempotent: a seat already SOLD is skipped without decrementing capacity again', async () => {
      const eventSeatUpdate = jest.fn();
      const eventZoneUpdate = jest.fn();
      prisma.$transaction.mockImplementation(async (callback) =>
        callback({
          eventSeat: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'seat-1', status: EventSeatStatus.SOLD, eventZoneId: 'zone-1' },
            ]),
            update: eventSeatUpdate,
          },
          eventZone: { update: eventZoneUpdate },
        }),
      );

      const result = await service.markSoldForPurchase(EVENT_ID, ['seat-1']);

      expect(result).toEqual({ updated: 0, requested: 1 });
      expect(eventSeatUpdate).not.toHaveBeenCalled();
      expect(eventZoneUpdate).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
