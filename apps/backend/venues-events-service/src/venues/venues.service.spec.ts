import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { VenuesService } from './venues.service';

const VENUE_ID = '550e8400-e29b-41d4-a716-446655440010';
const FLOOR_ID = '550e8400-e29b-41d4-a716-446655440011';
const SECTION_ID = '550e8400-e29b-41d4-a716-446655440012';

describe('VenuesService', () => {
  let service: VenuesService;

  const prisma = {
    venue: {
      findUnique: jest.fn(),
    },
    floor: {
      findUnique: jest.fn(),
    },
    section: {
      findUnique: jest.fn(),
    },
    eventZoneSection: {
      count: jest.fn(),
    },
    seat: {
      create: jest.fn(),
    },
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
        VenuesService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<VenuesService>(VenuesService);
  });

  test('blocks seat creation when the section is already assigned to an event zone', async () => {
    prisma.floor.findUnique.mockResolvedValue({
      id: FLOOR_ID,
      venueId: VENUE_ID,
    });
    prisma.section.findUnique.mockResolvedValue({
      id: SECTION_ID,
      floorId: FLOOR_ID,
      venueId: VENUE_ID,
    });
    prisma.eventZoneSection.count.mockResolvedValue(1);

    await expect(
      service.createSeat(VENUE_ID, FLOOR_ID, SECTION_ID, {
        name: 'A-1',
      } as never),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.seat.create).not.toHaveBeenCalled();
  });
});