import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventSeatStatus, EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { UpdateEventSeatDto } from './dto/update-event-seat.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  buildPaginatedResponse,
  toPrismaPagination,
} from '../common/pagination.helper';

interface EventSeatFilters {
  eventZoneId?: string;
  sectionId?: string;
  status?: EventSeatStatus;
}

@Injectable()
export class EventSeatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAllByEvent(
    eventId: string,
    filters: EventSeatFilters,
    pagination: PaginationQueryDto,
  ) {
    await this.findEvent(eventId);

    const where = {
      eventZone: { eventId },
      eventZoneId: filters.eventZoneId,
      sectionId: filters.sectionId,
      status: filters.status,
    };

    const { skip, take } = toPrismaPagination(pagination);

    const [eventSeats, total] = await this.prisma.$transaction([
      this.prisma.eventSeat.findMany({
        skip,
        take,
        where,
        include: {
          seat: {
            select: { id: true, row: true, number: true, type: true },
          },
        },
        // Orden estable y con sentido para el mapa de asientos; el id
        // desempata para que las páginas nunca se traslapen.
        orderBy: [
          { seat: { row: 'asc' } },
          { seat: { number: 'asc' } },
          { id: 'asc' },
        ],
      }),
      this.prisma.eventSeat.count({ where }),
    ]);

    return buildPaginatedResponse(eventSeats, total, pagination);
  }

  async findOne(eventId: string, seatId: string) {
    return this.findEventSeat(eventId, seatId);
  }

  async update(
    eventId: string,
    seatId: string,
    dto: UpdateEventSeatDto,
  ) {
    const eventSeat = await this.findEventSeat(eventId, seatId);
    const event = await this.findEvent(eventId);

    this.validateEventEditable(event.status);
    this.validateSeatEditable(eventSeat.status);

    const capacityDelta = this.capacityDelta(
      eventSeat.status,
      dto.status ?? eventSeat.status,
    );

    const updated = await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.eventSeat.update({
        where: { id: eventSeat.id },
        data: {
          status: dto.status,
          lockedUntil:
            dto.lockedUntil !== undefined
              ? new Date(dto.lockedUntil)
              : undefined,
        },
      });

      if (capacityDelta !== 0) {
        await transaction.eventZone.update({
          where: { id: eventSeat.eventZoneId },
          data: { availableCapacity: { increment: capacityDelta } },
        });
      }

      return result;
    });

    await this.invalidateEventCache(eventId);

    return updated;
  }

  async remove(eventId: string, seatId: string) {
    const eventSeat = await this.findEventSeat(eventId, seatId);
    const event = await this.findEvent(eventId);

    this.validateEventEditable(event.status);
    this.validateSeatEditable(eventSeat.status);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.eventSeat.delete({ where: { id: eventSeat.id } });

      if (eventSeat.status === EventSeatStatus.AVAILABLE) {
        await transaction.eventZone.update({
          where: { id: eventSeat.eventZoneId },
          data: { availableCapacity: { decrement: 1 } },
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

  private async findEventSeat(eventId: string, seatId: string) {
    const eventSeat = await this.prisma.eventSeat.findFirst({
      where: { seatId, eventZone: { eventId } },
      include: {
        seat: { select: { id: true, row: true, number: true, type: true } },
      },
    });

    if (!eventSeat) {
      throw new NotFoundException(
        `El asiento ${seatId} no está registrado en el evento ${eventId}`,
      );
    }

    return eventSeat;
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

  /** RESERVED/SOLD se gestionan desde el flujo de compra (purchases-service), no aquí */
  private validateSeatEditable(status: EventSeatStatus) {
    if (
      status === EventSeatStatus.RESERVED ||
      status === EventSeatStatus.SOLD
    ) {
      throw new ConflictException(
        `No se puede modificar un asiento en estado ${status}`,
      );
    }
  }

  private capacityDelta(
    previous: EventSeatStatus,
    next: EventSeatStatus,
  ): number {
    const wasAvailable = previous === EventSeatStatus.AVAILABLE;
    const isAvailable = next === EventSeatStatus.AVAILABLE;
    if (wasAvailable && !isAvailable) return -1;
    if (!wasAvailable && isAvailable) return 1;
    return 0;
  }

  private async invalidateEventCache(eventId: string) {
    await this.redis.del('events:list');
    await this.redis.del(`events:${eventId}`);
    await this.redis.del('catalog:events');
    await this.redis.del(`catalog:events:${eventId}`);
  }
}
