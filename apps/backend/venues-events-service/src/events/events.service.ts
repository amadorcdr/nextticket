import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, VenueStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

const EVENTS_LIST_CACHE_KEY = 'events:list';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateEventDto) {
    this.validateDateWindow(dto.startsAt, dto.endsAt);

    await this.validateVenue(dto.venueId);

    const event = await this.prisma.event.create({
      data: {
        venueId: dto.venueId,
        organizerId: dto.organizerId,
        name: dto.name,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        imageUrl: dto.imageUrl,
        description: dto.description,
        status: dto.status ?? EventStatus.DRAFT,
        createdBy: dto.organizerId,
      },
      include: {
        venue: true,
      },
    });

    await this.invalidateEventCache();

    return event;
  }

  async findAll(organizerId?: string, status?: EventStatus) {
    /*
     * Solo usamos caché para el listado general sin filtros.
     * Las consultas filtradas se resuelven directamente en PostgreSQL.
     */
    if (!organizerId && !status) {
      const cached = await this.redis.get<unknown[]>(
        EVENTS_LIST_CACHE_KEY,
      );

      if (cached) {
        return cached;
      }
    }

    const events = await this.prisma.event.findMany({
      where: {
        organizerId,
        status,
      },
      include: {
        venue: true,
        zones: {
          select: {
            id: true,
            publicName: true,
            eventPrice: true,
            availableCapacity: true,
            status: true,
          },
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    if (!organizerId && !status) {
      await this.redis.set(EVENTS_LIST_CACHE_KEY, events, 30);
    }

    return events;
  }

  async findOne(id: string) {
    const cacheKey = this.getEventCacheKey(id);

    const cached = await this.redis.get<unknown>(cacheKey);

    if (cached) {
      return cached;
    }

    const event = await this.prisma.event.findUnique({
      where: {
        id,
      },
      include: {
        venue: true,
        zones: {
          include: {
            priceTiers: {
              orderBy: {
                sortOrder: 'asc',
              },
            },
            sections: {
              include: {
                section: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event ${id} no existe`);
    }

    await this.redis.set(cacheKey, event, 30);

    return event;
  }

  async update(id: string, dto: UpdateEventDto) {
    const currentEvent = await this.findOneFromDatabase(id);

    const startsAt = dto.startsAt
      ? new Date(dto.startsAt)
      : currentEvent.startsAt;

    const endsAt = dto.endsAt
      ? new Date(dto.endsAt)
      : currentEvent.endsAt;

    this.validateDateWindow(startsAt, endsAt);

    if (dto.venueId && dto.venueId !== currentEvent.venueId) {
      await this.validateVenue(dto.venueId);

      const zonesCount = await this.prisma.eventZone.count({
        where: {
          eventId: id,
        },
      });

      if (zonesCount > 0) {
        throw new ConflictException(
          'No se puede cambiar el recinto después de configurar zonas',
        );
      }
    }

    const event = await this.prisma.event.update({
      where: {
        id,
      },
      data: {
        venueId: dto.venueId,
        name: dto.name,
        startsAt: dto.startsAt ? startsAt : undefined,
        endsAt: dto.endsAt ? endsAt : undefined,
        imageUrl: dto.imageUrl,
        description: dto.description,
        lastModifiedBy: currentEvent.organizerId,
      },
      include: {
        venue: true,
      },
    });

    await this.invalidateEventCache(id);

    return event;
  }

  async updateStatus(id: string, status: EventStatus) {
    const currentEvent = await this.findOneFromDatabase(id);

    this.validateStatusTransition(currentEvent.status, status);

    if (status === EventStatus.PUBLISHED) {
      await this.validateEventCanBePublished(id);
    }

    const event = await this.prisma.event.update({
      where: {
        id,
      },
      data: {
        status,
        lastModifiedBy: currentEvent.organizerId,
      },
      include: {
        venue: true,
      },
    });

    await this.invalidateEventCache(id);

    return event;
  }

  async remove(id: string) {
    const event = await this.findOneFromDatabase(id);

    const zonesCount = await this.prisma.eventZone.count({
      where: {
        eventId: id,
      },
    });

    if (zonesCount > 0) {
      throw new ConflictException(
        'No se puede eliminar un evento que ya tiene zonas configuradas',
      );
    }

    if (
      event.status !== EventStatus.DRAFT &&
      event.status !== EventStatus.CANCELED
    ) {
      throw new ConflictException(
        'Solo se pueden eliminar eventos en estado DRAFT o CANCELED',
      );
    }

    await this.prisma.event.delete({
      where: {
        id,
      },
    });

    await this.invalidateEventCache(id);

    return {
      deleted: true,
    };
  }

  private async findOneFromDatabase(id: string) {
    const event = await this.prisma.event.findUnique({
      where: {
        id,
      },
    });

    if (!event) {
      throw new NotFoundException(`Event ${id} no existe`);
    }

    return event;
  }

  private async validateVenue(venueId: string) {
    const venue = await this.prisma.venue.findUnique({
      where: {
        id: venueId,
      },
    });

    if (!venue) {
      throw new NotFoundException(`Venue ${venueId} no existe`);
    }

    if (
      venue.status === VenueStatus.REMOVED ||
      venue.status === VenueStatus.INACTIVE ||
      venue.status === VenueStatus.UNDER_MAINTENANCE
    ) {
      throw new ConflictException(
        `El recinto no está disponible para crear eventos. Estado: ${venue.status}`,
      );
    }
  }

  private validateDateWindow(
    startsAtValue: string | Date,
    endsAtValue: string | Date,
  ) {
    const startsAt = new Date(startsAtValue);
    const endsAt = new Date(endsAtValue);

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      throw new BadRequestException(
        'Las fechas del evento no son válidas',
      );
    }

    if (startsAt >= endsAt) {
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de finalización',
      );
    }
  }

  private validateStatusTransition(
    currentStatus: EventStatus,
    newStatus: EventStatus,
  ) {
    if (currentStatus === newStatus) {
      return;
    }

    const transitions: Record<EventStatus, EventStatus[]> = {
      [EventStatus.DRAFT]: [
        EventStatus.PUBLISHED,
        EventStatus.CANCELED,
      ],
      [EventStatus.PUBLISHED]: [
        EventStatus.SOLD_OUT,
        EventStatus.CANCELED,
        EventStatus.COMPLETED,
      ],
      [EventStatus.SOLD_OUT]: [
        EventStatus.PUBLISHED,
        EventStatus.CANCELED,
        EventStatus.COMPLETED,
      ],
      [EventStatus.CANCELED]: [],
      [EventStatus.COMPLETED]: [],
    };

    if (!transitions[currentStatus].includes(newStatus)) {
      throw new ConflictException(
        `No se permite cambiar el evento de ${currentStatus} a ${newStatus}`,
      );
    }
  }

  private async validateEventCanBePublished(eventId: string) {
    /*
     * Temporalmente permitimos publicar sin zonas para poder construir
     * y probar el módulo Events primero.
     *
     * Cuando terminemos EventZones, esta validación exigirá:
     * - Al menos una zona.
     * - Al menos una sección por zona.
     * - Precio configurado.
     * - EventSeats generados.
     */
    const event = await this.findOneFromDatabase(eventId);

    if (event.startsAt >= event.endsAt) {
      throw new BadRequestException(
        'El evento no tiene un intervalo de fechas válido',
      );
    }
  }

  private getEventCacheKey(id: string) {
    return `events:${id}`;
  }

  private async invalidateEventCache(id?: string) {
    await this.redis.del(EVENTS_LIST_CACHE_KEY);

    if (id) {
      await this.redis.del(this.getEventCacheKey(id));
    }
  }
}