import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AdmissionType,
  EventCategoryStatus,
  EventStatus,
  PriceTierStatus,
  VenueStatus,
} from '@prisma/client';
import { AUTH_ROLES } from '../auth/auth.constants';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsStatsResponseDto } from './dto/events-stats-response.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  buildPaginatedResponse,
  isCacheablePage,
  toPrismaPagination,
} from '../common/pagination.helper';

const EVENTS_LIST_CACHE_KEY = 'events:list';
const EVENTS_STATS_CACHE_KEY = 'events:stats';
const CATEGORY_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** También la usa VenuesService para bloquear la desactivación de un recinto
 *  con eventos en curso — ver venues.service.ts#updateVenue. */
export const ACTIVE_EVENT_STATUSES: EventStatus[] = [
  EventStatus.PUBLISHED,
  EventStatus.SOLD_OUT,
];

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private async validateCategories(categoryIds: string[]) {
    const categories = await this.prisma.eventCategory.findMany({
      where: {
        id: {
          in: categoryIds,
        },
        status: EventCategoryStatus.ACTIVE,
      },
    });

    if (categories.length !== categoryIds.length) {
      throw new BadRequestException(
        'Una o más categorías no existen o no están activas',
      );
    }
  }

  async create(dto: CreateEventDto, organizerId: string) {
    this.validateDateWindow(dto.startsAt, dto.endsAt);
    await this.validateVenue(dto.venueId);

    const categoryIds = [...new Set(dto.categoryIds ?? [])];

    if (categoryIds.length > 0) {
      await this.validateCategories(categoryIds);
    }

    const event = await this.prisma.$transaction(
      async (transaction) => {
        const createdEvent = await transaction.event.create({
          data: {
            venueId: dto.venueId,
            organizerId,
            name: dto.name,
            startsAt: new Date(dto.startsAt),
            endsAt: new Date(dto.endsAt),
            imageUrl: dto.imageUrl,
            description: dto.description,
            status: dto.status ?? EventStatus.DRAFT,
            createdBy: organizerId,
          },
        });

        if (categoryIds.length > 0) {
          await transaction.eventCategoryAssignment.createMany({
            data: categoryIds.map((categoryId) => ({
              eventId: createdEvent.id,
              categoryId,
            })),
          });
        }

        return transaction.event.findUnique({
          where: {
            id: createdEvent.id,
          },
          include: {
            venue: true,
            categories: {
              include: {
                category: true,
              },
            },
          },
        });
      },
    );

    await this.invalidateEventCache();

    return event;
  }

  async findAll(
    pagination: PaginationQueryDto,
    organizerId?: string,
    status?: EventStatus,
    categoryId?: string,
    categorySlug?: string,
    upcoming?: boolean,
  ) {
    if (categorySlug && !CATEGORY_SLUG_REGEX.test(categorySlug)) {
      throw new BadRequestException(
        'category solo puede contener letras minusculas, numeros y guiones',
      );
    }

    const hasFilters =
      Boolean(organizerId) ||
      Boolean(status) ||
      Boolean(categoryId) ||
      Boolean(categorySlug) ||
      Boolean(upcoming);

    /*
     * Solo usamos caché para la página por defecto del listado general sin
     * filtros, porque es la única que cabe en la llave que ya invalidamos.
     * El resto de páginas y las consultas filtradas se resuelven
     * directamente en PostgreSQL.
     */
    const useCache = !hasFilters && isCacheablePage(pagination);

    if (useCache) {
      const cached = await this.redis.get<PaginatedResponseDto<unknown>>(
        EVENTS_LIST_CACHE_KEY,
      );

      if (cached) {
        return cached;
      }
    }

    const where = {
      organizerId,
      status,
      startsAt: upcoming ? { gte: new Date() } : undefined,
      categories:
        categoryId || categorySlug
          ? {
            some: {
              category: {
                id: categoryId,
                slug: categorySlug,
                status: EventCategoryStatus.ACTIVE,
              },
            },
          }
          : undefined,
    };

    const { skip, take } = toPrismaPagination(pagination);

    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        skip,
        take,
        where,
        include: {
          venue: true,
          categories: {
            include: {
              category: true,
            },
          },
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
      }),
      this.prisma.event.count({ where }),
    ]);

    const response = buildPaginatedResponse(
      events,
      total,
      pagination,
    );

    if (useCache) {
      await this.redis.set(
        EVENTS_LIST_CACHE_KEY,
        response,
        30,
      );
    }

    return response;
  }

  async getStats(): Promise<EventsStatsResponseDto> {
    const cached = await this.redis.get<EventsStatsResponseDto>(
      EVENTS_STATS_CACHE_KEY,
    );

    if (cached) {
      return cached;
    }

    const now = new Date();

    const [totalEvents, activeEvents, upcomingEvents] =
      await this.prisma.$transaction([
        this.prisma.event.count(),
        this.prisma.event.count({
          where: { status: { in: ACTIVE_EVENT_STATUSES } },
        }),
        this.prisma.event.count({
          where: {
            status: { in: ACTIVE_EVENT_STATUSES },
            startsAt: { gt: now },
          },
        }),
      ]);

    const stats = { totalEvents, activeEvents, upcomingEvents };

    await this.redis.set(EVENTS_STATS_CACHE_KEY, stats, 30);

    return stats;
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
        categories: {
          include: {
            category: true,
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

  /** Un evento solo lo puede modificar su propio organizador, o un ADMIN. */
  private assertOwnerOrAdmin(
    event: { organizerId: string },
    user: AuthenticatedUser,
  ) {
    if (
      user.role !== AUTH_ROLES.ADMIN &&
      event.organizerId !== user.sub
    ) {
      throw new ForbiddenException(
        'No tienes permiso sobre este evento',
      );
    }
  }

  async update(id: string, dto: UpdateEventDto, user: AuthenticatedUser) {
    const currentEvent = await this.findOneFromDatabase(id);
    this.assertOwnerOrAdmin(currentEvent, user);
    const userId = user.sub;

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
        lastModifiedBy: userId,
      },
      include: {
        venue: true,
      },
    });

    await this.invalidateEventCache(id);

    return event;
  }

  /**
   * Actualiza imageUrl con la imagen recién subida a disco (ver
   * events.controller.ts#uploadImage). No pasa por UpdateEventDto porque el
   * valor lo arma este método (siempre una URL válida hacia
   * GET /events/images/:filename), no algo que mande el cliente.
   */
  async setImage(id: string, filename: string, user: AuthenticatedUser) {
    const currentEvent = await this.findOneFromDatabase(id);
    this.assertOwnerOrAdmin(currentEvent, user);
    const userId = user.sub;

    const gatewayUrl = process.env.GATEWAY_URL ?? 'http://localhost:3001';
    const imageUrl = `${gatewayUrl}/events/images/${filename}`;

    const event = await this.prisma.event.update({
      where: {
        id,
      },
      data: {
        imageUrl,
        lastModifiedBy: userId,
      },
      include: {
        venue: true,
      },
    });

    await this.invalidateEventCache(id);

    return event;
  }

  async updateStatus(id: string, status: EventStatus, user: AuthenticatedUser) {
    const currentEvent = await this.findOneFromDatabase(id);
    this.assertOwnerOrAdmin(currentEvent, user);
    const userId = user.sub;

    this.validateStatusTransition(currentEvent.status, status);

    if (status === EventStatus.PUBLISHED) {
      await this.validateEventCanBePublished(id);
    }

    if (status === EventStatus.CANCELED) {
      await this.validateEventCanBeCanceled(id);
    }

    const event = await this.prisma.event.update({
      where: {
        id,
      },
      data: {
        status,
        lastModifiedBy: userId,
      },
      include: {
        venue: true,
      },
    });

    await this.invalidateEventCache(id);

    return event;
  }

  async remove(id: string, user: AuthenticatedUser) {
    const event = await this.findOneFromDatabase(id);
    this.assertOwnerOrAdmin(event, user);

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

    // event_category_assignments apunta al evento con onDelete: Restrict (a
    // propósito, para no perder el historial en el caso normal). Al borrar
    // un DRAFT/CANCELED sin zonas no hay nada que proteger ahí, así que se
    // limpia antes o la base rechaza el delete con un error crudo.
    await this.prisma.$transaction([
      this.prisma.eventCategoryAssignment.deleteMany({
        where: {
          eventId: id,
        },
      }),
      this.prisma.event.delete({
        where: {
          id,
        },
      }),
    ]);

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
    const event = await this.prisma.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        startsAt: true,
        endsAt: true,
        zones: {
          select: {
            id: true,
            publicName: true,
            admissionType: true,
            eventPrice: true,
            sections: {
              select: {
                id: true,
              },
            },
            priceTiers: {
              where: {
                status: PriceTierStatus.ACTIVE,
              },
              select: {
                id: true,
              },
            },
            eventSeats: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event ${eventId} no existe`);
    }

    if (event.startsAt >= event.endsAt) {
      throw new BadRequestException(
        'El evento no tiene un intervalo de fechas válido',
      );
    }

    if (event.zones.length === 0) {
      throw new ConflictException(
        'No se puede publicar un evento sin zonas configuradas',
      );
    }

    for (const zone of event.zones) {
      if (zone.sections.length === 0) {
        throw new ConflictException(
          `La zona "${zone.publicName}" no tiene secciones asignadas`,
        );
      }

      if (zone.eventPrice === null || zone.eventPrice === undefined || Number(zone.eventPrice) <= 0) {
        throw new ConflictException(
          `La zona "${zone.publicName}" no tiene un precio configurado`,
        );
      }

      if (zone.priceTiers.length === 0) {
        throw new ConflictException(
          `La zona "${zone.publicName}" no tiene al menos un price tier activo`,
        );
      }

      if (
        zone.admissionType === AdmissionType.RESERVED &&
        zone.eventSeats.length === 0
      ) {
        throw new ConflictException(
          `La zona "${zone.publicName}" no tiene asientos generados`,
        );
      }
    }
  }

  /**
   * No se puede cancelar un evento que ya tiene boletos vendidos: un
   * organizador podría cancelarlo por error (o de mala fe) dejando a
   * compradores reales sin evento. El conteo de boletos vive en
   * tickets-service (otra base de datos), así que se consulta por HTTP con
   * el mismo token interno que ya usan purchases-service ↔ tickets-service.
   */
  private async validateEventCanBeCanceled(eventId: string) {
    const zones = await this.prisma.eventZone.findMany({
      where: { eventId },
      select: { id: true },
    });

    if (zones.length === 0) return;

    const soldCount = await this.getSoldTicketsCount(zones.map((z) => z.id));

    if (soldCount > 0) {
      throw new ConflictException(
        `No se puede cancelar el evento: tiene ${soldCount} boleto${soldCount === 1 ? '' : 's'} vendido${soldCount === 1 ? '' : 's'}.`,
      );
    }
  }

  private async getSoldTicketsCount(eventZoneIds: string[]): Promise<number> {
    const baseUrl = process.env.TICKETS_SERVICE_URL ?? 'http://localhost:3005';
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? '';

    let response: Response;
    try {
      response = await fetch(
        `${baseUrl}/tickets/internal/sold-count?eventZoneIds=${eventZoneIds.join(',')}`,
        { headers: { 'X-Internal-Service-Token': internalToken } },
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar si el evento tiene boletos vendidos. Intenta de nuevo en unos segundos.',
      );
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        'No se pudo verificar si el evento tiene boletos vendidos. Intenta de nuevo en unos segundos.',
      );
    }

    const stats = (await response.json()) as { sold?: number };
    return stats.sold ?? 0;
  }

  private getEventCacheKey(id: string) {
    return `events:${id}`;
  }

  private async invalidateEventCache(id?: string) {
    await this.redis.del(EVENTS_LIST_CACHE_KEY);
    await this.redis.del(EVENTS_STATS_CACHE_KEY);

    if (id) {
      await this.redis.del(this.getEventCacheKey(id));
    }
  }

  async assignCategories(
    eventId: string,
    categoryIds: string[],
    user: AuthenticatedUser,
  ) {
    const currentEvent = await this.findOneFromDatabase(eventId);
    this.assertOwnerOrAdmin(currentEvent, user);
    const userId = user.sub;

    const uniqueCategoryIds = [...new Set(categoryIds)];

    await this.validateCategories(uniqueCategoryIds);

    const existingAssignments =
      await this.prisma.eventCategoryAssignment.findMany({
        where: {
          eventId,
          categoryId: {
            in: uniqueCategoryIds,
          },
        },
        select: {
          categoryId: true,
        },
      });

    const existingIds = new Set(
      existingAssignments.map(
        (assignment) => assignment.categoryId,
      ),
    );

    const newCategoryIds = uniqueCategoryIds.filter(
      (categoryId) => !existingIds.has(categoryId),
    );

    if (newCategoryIds.length > 0) {
      await this.prisma.eventCategoryAssignment.createMany({
        data: newCategoryIds.map((categoryId) => ({
          eventId,
          categoryId,
        })),
      });
    }

    await this.invalidateEventCache(eventId);

    await this.prisma.event.update({
      where: {
        id: eventId,
      },
      data: {
        lastModifiedBy: userId,
      },
    });

    return this.findOne(eventId);
  }

  async removeCategory(
    eventId: string,
    categoryId: string,
    user: AuthenticatedUser,
  ) {
    const currentEvent = await this.findOneFromDatabase(eventId);
    this.assertOwnerOrAdmin(currentEvent, user);
    const userId = user.sub;

    const assignment =
      await this.prisma.eventCategoryAssignment.findUnique({
        where: {
          eventId_categoryId: {
            eventId,
            categoryId,
          },
        },
      });

    if (!assignment) {
      throw new NotFoundException(
        'La categoría no está asignada al evento',
      );
    }

    await this.prisma.eventCategoryAssignment.delete({
      where: {
        id: assignment.id,
      },
    });

    await this.invalidateEventCache(eventId);

    await this.prisma.event.update({
      where: {
        id: eventId,
      },
      data: {
        lastModifiedBy: userId,
      },
    });

    return this.findOne(eventId);
  }
}
