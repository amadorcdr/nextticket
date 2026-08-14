import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EventSeatStatus,
  EventStatus,
  SeatStatus,
  SectionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateEventSectionDto } from './dto/create-event-section.dto';
import { UpdateEventSectionDto } from './dto/update-event-section.dto';

@Injectable()
export class EventSectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(eventId: string, dto: CreateEventSectionDto) {
    const event = await this.findEvent(eventId);
    this.validateEventEditable(event.status);

    const zone = await this.findZone(eventId, dto.eventZoneId);

    const sectionIds = [...new Set(dto.sectionIds)];
    const sections = await this.validateSections(
      event.venueId,
      eventId,
      sectionIds,
    );

    const newSeatsCount = sections.reduce(
      (total, section) => total + section.seats.length,
      0,
    );

    if (newSeatsCount === 0) {
      throw new ConflictException(
        'Las secciones seleccionadas no tienen asientos disponibles',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.eventZoneSection.createMany({
        data: sectionIds.map((sectionId) => ({
          eventId,
          eventZoneId: zone.id,
          sectionId,
        })),
      });

      const eventSeatsData = sections.flatMap((section) =>
        section.seats.map((seat) => ({
          eventZoneId: zone.id,
          sectionId: section.id,
          seatId: seat.id,
          status: EventSeatStatus.AVAILABLE,
        })),
      );

      await transaction.eventSeat.createMany({
        data: eventSeatsData,
      });

      await transaction.eventZone.update({
        where: { id: zone.id },
        data: {
          availableCapacity: { increment: newSeatsCount },
          lastModifiedBy: event.organizerId,
        },
      });

      const regularTier =
        await transaction.eventZonePriceTier.findFirst({
          where: { eventZoneId: zone.id, sortOrder: 0 },
        });

      if (regularTier) {
        await transaction.eventZonePriceTier.update({
          where: { id: regularTier.id },
          data: {
            initialCapacity: { increment: newSeatsCount },
            availableCapacity: { increment: newSeatsCount },
            lastModifiedBy: event.organizerId,
          },
        });
      }
    });

    await this.invalidateEventCache(eventId);

    return this.findAllByEvent(eventId);
  }

  async findAllByEvent(eventId: string) {
    await this.findEvent(eventId);

    return this.prisma.eventZoneSection.findMany({
      where: { eventId },
      include: {
        section: {
          select: {
            id: true,
            name: true,
            capacity: true,
            status: true,
            color: true,
          },
        },
        eventZone: {
          select: { id: true, publicName: true, status: true },
        },
      },
    });
  }

  async findOne(eventId: string, sectionId: string) {
    const relation = await this.prisma.eventZoneSection.findFirst({
      where: { eventId, sectionId },
      include: {
        section: true,
        eventZone: true,
      },
    });

    if (!relation) {
      throw new NotFoundException(
        `La sección ${sectionId} no está asignada a ninguna zona del evento ${eventId}`,
      );
    }

    return relation;
  }

  async update(
    eventId: string,
    sectionId: string,
    dto: UpdateEventSectionDto,
  ) {
    const relation = await this.findOne(eventId, sectionId);
    const event = await this.findEvent(eventId);

    this.validateEventEditable(event.status);

    if (dto.eventZoneId === relation.eventZoneId) {
      return relation;
    }

    const targetZone = await this.findZone(eventId, dto.eventZoneId);

    const occupiedSeats = await this.prisma.eventSeat.count({
      where: {
        eventZoneId: relation.eventZoneId,
        sectionId,
        status: {
          in: [EventSeatStatus.RESERVED, EventSeatStatus.SOLD],
        },
      },
    });

    if (occupiedSeats > 0) {
      throw new ConflictException(
        'No se puede reasignar una sección con asientos reservados o vendidos',
      );
    }

    const availableSeats = await this.prisma.eventSeat.count({
      where: {
        eventZoneId: relation.eventZoneId,
        sectionId,
        status: EventSeatStatus.AVAILABLE,
      },
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.eventSeat.updateMany({
        where: { eventZoneId: relation.eventZoneId, sectionId },
        data: { eventZoneId: targetZone.id },
      });

      await transaction.eventZoneSection.update({
        where: { id: relation.id },
        data: { eventZoneId: targetZone.id },
      });

      await transaction.eventZone.update({
        where: { id: relation.eventZoneId },
        data: {
          availableCapacity: { decrement: availableSeats },
          lastModifiedBy: event.organizerId,
        },
      });

      await transaction.eventZone.update({
        where: { id: targetZone.id },
        data: {
          availableCapacity: { increment: availableSeats },
          lastModifiedBy: event.organizerId,
        },
      });

      const previousTier = await transaction.eventZonePriceTier.findFirst({
        where: { eventZoneId: relation.eventZoneId, sortOrder: 0 },
      });

      if (previousTier) {
        await transaction.eventZonePriceTier.update({
          where: { id: previousTier.id },
          data: {
            initialCapacity: Math.max(
              0,
              (previousTier.initialCapacity ?? 0) - availableSeats,
            ),
            availableCapacity: Math.max(
              0,
              (previousTier.availableCapacity ?? 0) - availableSeats,
            ),
            lastModifiedBy: event.organizerId,
          },
        });
      }

      const targetTier = await transaction.eventZonePriceTier.findFirst({
        where: { eventZoneId: targetZone.id, sortOrder: 0 },
      });

      if (targetTier) {
        await transaction.eventZonePriceTier.update({
          where: { id: targetTier.id },
          data: {
            initialCapacity: { increment: availableSeats },
            availableCapacity: { increment: availableSeats },
            lastModifiedBy: event.organizerId,
          },
        });
      }
    });

    await this.invalidateEventCache(eventId);

    return this.findOne(eventId, sectionId);
  }

  async remove(eventId: string, sectionId: string) {
    const relation = await this.findOne(eventId, sectionId);
    const event = await this.findEvent(eventId);

    this.validateEventEditable(event.status);

    const unavailableSeats = await this.prisma.eventSeat.count({
      where: {
        eventZoneId: relation.eventZoneId,
        sectionId,
        status: {
          in: [EventSeatStatus.RESERVED, EventSeatStatus.SOLD],
        },
      },
    });

    if (unavailableSeats > 0) {
      throw new ConflictException(
        'No se puede retirar una sección que tiene asientos reservados o vendidos',
      );
    }

    const availableSeats = await this.prisma.eventSeat.count({
      where: {
        eventZoneId: relation.eventZoneId,
        sectionId,
        status: EventSeatStatus.AVAILABLE,
      },
    });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.eventSeat.deleteMany({
        where: { eventZoneId: relation.eventZoneId, sectionId },
      });

      await transaction.eventZoneSection.delete({
        where: { id: relation.id },
      });

      await transaction.eventZone.update({
        where: { id: relation.eventZoneId },
        data: {
          availableCapacity: { decrement: availableSeats },
          lastModifiedBy: event.organizerId,
        },
      });

      const regularTier =
        await transaction.eventZonePriceTier.findFirst({
          where: { eventZoneId: relation.eventZoneId, sortOrder: 0 },
        });

      if (regularTier) {
        await transaction.eventZonePriceTier.update({
          where: { id: regularTier.id },
          data: {
            initialCapacity: Math.max(
              0,
              (regularTier.initialCapacity ?? 0) - availableSeats,
            ),
            availableCapacity: Math.max(
              0,
              (regularTier.availableCapacity ?? 0) - availableSeats,
            ),
            lastModifiedBy: event.organizerId,
          },
        });
      }
    });

    await this.invalidateEventCache(eventId);

    return { deleted: true };
  }

  private async findEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} no existe`);
    }
    return event;
  }

  private async findZone(eventId: string, eventZoneId: string) {
    const zone = await this.prisma.eventZone.findFirst({
      where: { id: eventZoneId, eventId },
    });
    if (!zone) {
      throw new NotFoundException(
        `EventZone ${eventZoneId} no existe en el evento ${eventId}`,
      );
    }
    return zone;
  }

  private async validateSections(
    venueId: string,
    eventId: string,
    sectionIds: string[],
  ) {
    const sections = await this.prisma.section.findMany({
      where: { id: { in: sectionIds } },
      include: {
        seats: { where: { status: SeatStatus.AVAILABLE } },
      },
    });

    if (sections.length !== sectionIds.length) {
      throw new NotFoundException('Una o más secciones no existen');
    }

    const invalidVenueSection = sections.find(
      (section) => section.venueId !== venueId,
    );

    if (invalidVenueSection) {
      throw new ConflictException(
        `La sección ${invalidVenueSection.id} no pertenece al recinto del evento`,
      );
    }

    const inactiveSection = sections.find(
      (section) => section.status !== SectionStatus.ACTIVE,
    );

    if (inactiveSection) {
      throw new ConflictException(
        `La sección ${inactiveSection.id} no está activa`,
      );
    }

    const assignedSections = await this.prisma.eventZoneSection.findMany({
      where: { eventId, sectionId: { in: sectionIds } },
    });

    if (assignedSections.length > 0) {
      throw new ConflictException(
        'Una o más secciones ya pertenecen a otra zona del evento',
      );
    }

    return sections;
  }

  private validateEventEditable(status: EventStatus) {
    if (
      status === EventStatus.CANCELED ||
      status === EventStatus.COMPLETED
    ) {
      throw new ConflictException(
        `No se puede modificar un evento en estado ${status}`,
      );
    }
  }

  private async invalidateEventCache(eventId: string) {
    await this.redis.del('events:list');
    await this.redis.del(`events:${eventId}`);
    await this.redis.del('catalog:events');
    await this.redis.del(`catalog:events:${eventId}`);
  }
}
