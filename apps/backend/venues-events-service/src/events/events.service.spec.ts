import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AdmissionType, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { EventsService } from './events.service';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440001';
// ADMIN para que assertOwnerOrAdmin no dependa del organizerId que estos mocks no incluyen.
const ADMIN_USER = { sub: USER_ID, email: 'admin@test.com', role: 'ADMIN' };

describe('EventsService', () => {
  let service: EventsService;

  const prisma = {
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<EventsService>(EventsService);
  });

  test('does not publish an event without zones', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: EVENT_ID,
        status: EventStatus.DRAFT,
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
      })
      .mockResolvedValueOnce({
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
        zones: [],
      });

    await expect(
      service.updateStatus(EVENT_ID, EventStatus.PUBLISHED, ADMIN_USER),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  test('does not publish an event with a zone without sections', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: EVENT_ID,
        status: EventStatus.DRAFT,
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
      })
      .mockResolvedValueOnce({
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
        zones: [
          {
            id: 'zone-1',
            publicName: 'Zona principal',
            admissionType: AdmissionType.RESERVED,
            sections: [],
            priceTiers: [{ id: 'tier-1' }],
            eventSeats: [{ id: 'event-seat-1' }],
          },
        ],
      });

    await expect(
      service.updateStatus(EVENT_ID, EventStatus.PUBLISHED, ADMIN_USER),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  test('does not publish an event with a zone without a configured price', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: EVENT_ID,
        status: EventStatus.DRAFT,
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
      })
      .mockResolvedValueOnce({
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
        zones: [
          {
            id: 'zone-1',
            publicName: 'Zona principal',
            admissionType: AdmissionType.RESERVED,
            eventPrice: 0,
            sections: [{ id: 'section-1' }],
            priceTiers: [{ id: 'tier-1' }],
            eventSeats: [{ id: 'event-seat-1' }],
          },
        ],
      });

    await expect(
      service.updateStatus(EVENT_ID, EventStatus.PUBLISHED, ADMIN_USER),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  test('does not publish an event with a zone without an active price tier', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: EVENT_ID,
        status: EventStatus.DRAFT,
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
      })
      .mockResolvedValueOnce({
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
        zones: [
          {
            id: 'zone-1',
            publicName: 'Zona principal',
            admissionType: AdmissionType.RESERVED,
            eventPrice: 100,
            sections: [{ id: 'section-1' }],
            priceTiers: [],
            eventSeats: [{ id: 'event-seat-1' }],
          },
        ],
      });

    await expect(
      service.updateStatus(EVENT_ID, EventStatus.PUBLISHED, ADMIN_USER),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.event.update).not.toHaveBeenCalled();
  });

  test('publishes when the event is fully configured', async () => {
    prisma.event.findUnique
      .mockResolvedValueOnce({
        id: EVENT_ID,
        status: EventStatus.DRAFT,
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
      })
      .mockResolvedValueOnce({
        startsAt: new Date('2026-07-30T10:00:00Z'),
        endsAt: new Date('2026-07-30T12:00:00Z'),
        zones: [
          {
            id: 'zone-1',
            publicName: 'Zona principal',
            admissionType: AdmissionType.RESERVED,
            eventPrice: 100,
            sections: [{ id: 'section-1' }],
            priceTiers: [{ id: 'tier-1' }],
            eventSeats: [{ id: 'event-seat-1' }],
          },
        ],
      });
    prisma.event.update.mockResolvedValue({
      id: EVENT_ID,
      status: EventStatus.PUBLISHED,
    });

    await expect(
      service.updateStatus(EVENT_ID, EventStatus.PUBLISHED, ADMIN_USER),
    ).resolves.toEqual(
      expect.objectContaining({
        status: EventStatus.PUBLISHED,
      }),
    );

    expect(prisma.event.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: EVENT_ID },
        data: expect.objectContaining({ status: EventStatus.PUBLISHED }),
      }),
    );
    expect(redis.del).toHaveBeenCalledWith('events:list');
  });

  test('does not allow an invalid transition from canceled to published', async () => {
    prisma.event.findUnique.mockResolvedValueOnce({
      id: EVENT_ID,
      status: EventStatus.CANCELED,
      startsAt: new Date('2026-07-30T10:00:00Z'),
      endsAt: new Date('2026-07-30T12:00:00Z'),
    });

    await expect(
      service.updateStatus(EVENT_ID, EventStatus.PUBLISHED, ADMIN_USER),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.event.update).not.toHaveBeenCalled();
    expect(prisma.event.findUnique).toHaveBeenCalledTimes(1);
  });

  describe('getStats', () => {
    it('returns aggregated counts and caches the result', async () => {
      redis.get.mockResolvedValueOnce(null);
      prisma.$transaction.mockResolvedValueOnce([24, 9, 6]);

      await expect(service.getStats()).resolves.toEqual({
        totalEvents: 24,
        activeEvents: 9,
        upcomingEvents: 6,
      });

      expect(redis.set).toHaveBeenCalledWith(
        'events:stats',
        { totalEvents: 24, activeEvents: 9, upcomingEvents: 6 },
        30,
      );
    });

    it('returns the cached value without touching the database', async () => {
      redis.get.mockResolvedValueOnce({
        totalEvents: 1,
        activeEvents: 1,
        upcomingEvents: 1,
      });

      await expect(service.getStats()).resolves.toEqual({
        totalEvents: 1,
        activeEvents: 1,
        upcomingEvents: 1,
      });

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('findAll upcoming filter', () => {
    it('adds a startsAt >= now filter when upcoming is true', async () => {
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll(
        { page: 1, limit: 20 },
        undefined,
        undefined,
        undefined,
        undefined,
        true,
      );

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startsAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('does not filter by date when upcoming is not set', async () => {
      redis.get.mockResolvedValueOnce(null);
      prisma.$transaction.mockResolvedValueOnce([[], 0]);

      await service.findAll({ page: 1, limit: 20 });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ startsAt: undefined }),
        }),
      );
    });
  });
});