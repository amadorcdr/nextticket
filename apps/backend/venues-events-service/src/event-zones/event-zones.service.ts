import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdmissionType,
  EventSeatStatus,
  EventStatus,
  EventZoneStatus,
  PriceTierStatus,
  Prisma,
  SeatStatus,
  SectionStatus,
} from '@prisma/client';
import { AUTH_ROLES } from '../auth/auth.constants';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AssignSectionsDto } from './dto/assign-sections.dto';
import { CreateEventZoneDto } from './dto/create-event-zone.dto';
import { CreatePriceTierDto } from './dto/create-price-tier.dto';
import { UpdateEventZoneDto } from './dto/update-event-zone.dto';
import { UpdatePriceTierDto } from './dto/update-price-tier.dto';

@Injectable()
export class EventZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Las zonas comerciales de un evento solo las toca su organizador, o un ADMIN. */
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

  async create(eventId: string, dto: CreateEventZoneDto, user: AuthenticatedUser) {
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);

    const sectionIds = [...new Set(dto.sectionIds)];

    await this.validateSections(
      event.venueId,
      eventId,
      sectionIds,
    );

    const sections = await this.prisma.section.findMany({
      where: {
        id: {
          in: sectionIds,
        },
      },
      include: {
        seats: {
          where: {
            status: SeatStatus.AVAILABLE,
          },
        },
      },
    });

    const totalAvailableSeats = sections.reduce(
      (total, section) => total + section.seats.length,
      0,
    );

    if (totalAvailableSeats === 0) {
      throw new ConflictException(
        'Las secciones seleccionadas no tienen asientos disponibles',
      );
    }

    const zone = await this.prisma.$transaction(
      async (transaction) => {
        const createdZone = await transaction.eventZone.create({
          data: {
            eventId,
            publicName: dto.publicName,
            admissionType:
              dto.admissionType ?? AdmissionType.RESERVED,
            eventPrice: new Prisma.Decimal(dto.eventPrice),
            availableCapacity: totalAvailableSeats,
            mapColor: dto.mapColor,
            maxTicketsPerPurchase:
              dto.maxTicketsPerPurchase ?? 10,
            status: dto.status ?? EventZoneStatus.ACTIVE,
            createdBy: event.organizerId,
          },
        });

        await transaction.eventZoneSection.createMany({
          data: sectionIds.map((sectionId) => ({
            eventId,
            eventZoneId: createdZone.id,
            sectionId,
          })),
        });

        const eventSeatsData = sections.flatMap((section) =>
          section.seats.map((seat) => ({
            eventZoneId: createdZone.id,
            sectionId: section.id,
            seatId: seat.id,
            status: EventSeatStatus.AVAILABLE,
          })),
        );

        await transaction.eventSeat.createMany({
          data: eventSeatsData,
        });

        await transaction.eventZonePriceTier.create({
          data: {
            eventZoneId: createdZone.id,
            name: 'Regular',
            price: new Prisma.Decimal(dto.eventPrice),
            initialCapacity: totalAvailableSeats,
            availableCapacity: totalAvailableSeats,
            sortOrder: 0,
            status: PriceTierStatus.ACTIVE,
            createdBy: event.organizerId,
          },
        });

        return transaction.eventZone.findUnique({
          where: {
            id: createdZone.id,
          },
          include: this.zoneInclude(),
        });
      },
    );

    await this.invalidateEventCache(eventId);

    return zone;
  }

  async findAllByEvent(eventId: string) {
    await this.findEvent(eventId);

    return this.prisma.eventZone.findMany({
      where: {
        eventId,
      },
      include: this.zoneInclude(),
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async findOne(eventId: string, zoneId: string) {
    const zone = await this.prisma.eventZone.findFirst({
      where: {
        id: zoneId,
        eventId,
      },
      include: this.zoneInclude(),
    });

    if (!zone) {
      throw new NotFoundException(
        `EventZone ${zoneId} no existe en el evento ${eventId}`,
      );
    }

    return zone;
  }

  async update(
    eventId: string,
    zoneId: string,
    dto: UpdateEventZoneDto,
    user: AuthenticatedUser,
  ) {
    const zone = await this.findOne(eventId, zoneId);
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);

    const updatedZone = await this.prisma.$transaction(
      async (transaction) => {
        const updated = await transaction.eventZone.update({
          where: {
            id: zoneId,
          },
          data: {
            publicName: dto.publicName,
            admissionType: dto.admissionType,
            eventPrice:
              dto.eventPrice !== undefined
                ? new Prisma.Decimal(dto.eventPrice)
                : undefined,
            mapColor: dto.mapColor,
            maxTicketsPerPurchase:
              dto.maxTicketsPerPurchase,
            status: dto.status,
            lastModifiedBy: event.organizerId,
          },
        });

        if (dto.eventPrice !== undefined) {
          const activeRegularTier =
            await transaction.eventZonePriceTier.findFirst({
              where: {
                eventZoneId: zoneId,
                sortOrder: 0,
              },
            });

          if (activeRegularTier) {
            await transaction.eventZonePriceTier.update({
              where: {
                id: activeRegularTier.id,
              },
              data: {
                price: new Prisma.Decimal(dto.eventPrice),
                lastModifiedBy: event.organizerId,
              },
            });
          }
        }

        return transaction.eventZone.findUnique({
          where: {
            id: zoneId,
          },
          include: this.zoneInclude(),
        });
      },
    );

    await this.invalidateEventCache(eventId);

    return updatedZone;
  }

  async assignSections(
    eventId: string,
    zoneId: string,
    dto: AssignSectionsDto,
    user: AuthenticatedUser,
  ) {
    const zone = await this.findOne(eventId, zoneId);
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);

    const sectionIds = [...new Set(dto.sectionIds)];

    await this.validateSections(
      event.venueId,
      eventId,
      sectionIds,
    );

    const sections = await this.prisma.section.findMany({
      where: {
        id: {
          in: sectionIds,
        },
      },
      include: {
        seats: {
          where: {
            status: SeatStatus.AVAILABLE,
          },
        },
      },
    });

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
          eventZoneId: zoneId,
          sectionId,
        })),
      });

      const eventSeatsData = sections.flatMap((section) =>
        section.seats.map((seat) => ({
          eventZoneId: zoneId,
          sectionId: section.id,
          seatId: seat.id,
          status: EventSeatStatus.AVAILABLE,
        })),
      );

      await transaction.eventSeat.createMany({
        data: eventSeatsData,
      });

      await transaction.eventZone.update({
        where: {
          id: zoneId,
        },
        data: {
          availableCapacity: {
            increment: newSeatsCount,
          },
          lastModifiedBy: event.organizerId,
        },
      });

      const regularTier =
        await transaction.eventZonePriceTier.findFirst({
          where: {
            eventZoneId: zoneId,
            sortOrder: 0,
          },
        });

      if (regularTier) {
        await transaction.eventZonePriceTier.update({
          where: {
            id: regularTier.id,
          },
          data: {
            initialCapacity: {
              increment: newSeatsCount,
            },
            availableCapacity: {
              increment: newSeatsCount,
            },
            lastModifiedBy: event.organizerId,
          },
        });
      }
    });

    await this.invalidateEventCache(eventId);

    return this.findOne(eventId, zoneId);
  }

  async removeSection(
    eventId: string,
    zoneId: string,
    sectionId: string,
    user: AuthenticatedUser,
  ) {
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);

    const relation =
      await this.prisma.eventZoneSection.findFirst({
        where: {
          eventId,
          eventZoneId: zoneId,
          sectionId,
        },
      });

    if (!relation) {
      throw new NotFoundException(
        'La sección no pertenece a la zona indicada',
      );
    }

    const unavailableSeats =
      await this.prisma.eventSeat.count({
        where: {
          eventZoneId: zoneId,
          sectionId,
          status: {
            in: [
              EventSeatStatus.RESERVED,
              EventSeatStatus.SOLD,
            ],
          },
        },
      });

    if (unavailableSeats > 0) {
      throw new ConflictException(
        'No se puede retirar una sección que tiene asientos reservados o vendidos',
      );
    }

    const availableSeats =
      await this.prisma.eventSeat.count({
        where: {
          eventZoneId: zoneId,
          sectionId,
          status: EventSeatStatus.AVAILABLE,
        },
      });

    await this.prisma.$transaction(async (transaction) => {
      await transaction.eventSeat.deleteMany({
        where: {
          eventZoneId: zoneId,
          sectionId,
        },
      });

      await transaction.eventZoneSection.delete({
        where: {
          id: relation.id,
        },
      });

      await transaction.eventZone.update({
        where: {
          id: zoneId,
        },
        data: {
          availableCapacity: {
            decrement: availableSeats,
          },
          lastModifiedBy: event.organizerId,
        },
      });

      const regularTier =
        await transaction.eventZonePriceTier.findFirst({
          where: {
            eventZoneId: zoneId,
            sortOrder: 0,
          },
        });

      if (regularTier) {
        await transaction.eventZonePriceTier.update({
          where: {
            id: regularTier.id,
          },
          data: {
            initialCapacity: Math.max(
              0,
              (regularTier.initialCapacity ?? 0) -
                availableSeats,
            ),
            availableCapacity: Math.max(
              0,
              (regularTier.availableCapacity ?? 0) -
                availableSeats,
            ),
            lastModifiedBy: event.organizerId,
          },
        });
      }
    });

    await this.invalidateEventCache(eventId);

    return this.findOne(eventId, zoneId);
  }

  async createPriceTier(
    eventId: string,
    zoneId: string,
    dto: CreatePriceTierDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne(eventId, zoneId);
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);
    this.validateTierDateWindow(
      dto.startsAt,
      dto.endsAt,
    );

    const sortOrder =
      dto.sortOrder ??
      (await this.prisma.eventZonePriceTier.count({
        where: {
          eventZoneId: zoneId,
        },
      }));

    const tier =
      await this.prisma.eventZonePriceTier.create({
        data: {
          eventZoneId: zoneId,
          name: dto.name,
          price: new Prisma.Decimal(dto.price),
          initialCapacity: dto.initialCapacity,
          availableCapacity: dto.initialCapacity,
          startsAt: dto.startsAt
            ? new Date(dto.startsAt)
            : undefined,
          endsAt: dto.endsAt
            ? new Date(dto.endsAt)
            : undefined,
          sortOrder,
          status: dto.status ?? PriceTierStatus.PENDING,
          createdBy: event.organizerId,
        },
      });

    await this.invalidateEventCache(eventId);

    return tier;
  }

  async updatePriceTier(
    eventId: string,
    zoneId: string,
    tierId: string,
    dto: UpdatePriceTierDto,
    user: AuthenticatedUser,
  ) {
    await this.findOne(eventId, zoneId);
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);
    this.validateTierDateWindow(
      dto.startsAt,
      dto.endsAt,
    );

    const tier =
      await this.prisma.eventZonePriceTier.findFirst({
        where: {
          id: tierId,
          eventZoneId: zoneId,
        },
      });

    if (!tier) {
      throw new NotFoundException(
        `PriceTier ${tierId} no existe`,
      );
    }

    if (
      dto.availableCapacity !== undefined &&
      dto.initialCapacity !== undefined &&
      dto.availableCapacity > dto.initialCapacity
    ) {
      throw new BadRequestException(
        'La capacidad disponible no puede ser mayor que la capacidad inicial',
      );
    }

    const updated =
      await this.prisma.eventZonePriceTier.update({
        where: {
          id: tierId,
        },
        data: {
          name: dto.name,
          price:
            dto.price !== undefined
              ? new Prisma.Decimal(dto.price)
              : undefined,
          initialCapacity: dto.initialCapacity,
          availableCapacity: dto.availableCapacity,
          startsAt: dto.startsAt
            ? new Date(dto.startsAt)
            : undefined,
          endsAt: dto.endsAt
            ? new Date(dto.endsAt)
            : undefined,
          sortOrder: dto.sortOrder,
          status: dto.status,
          lastModifiedBy: event.organizerId,
        },
      });

    await this.invalidateEventCache(eventId);

    return updated;
  }

  async removePriceTier(
    eventId: string,
    zoneId: string,
    tierId: string,
    user: AuthenticatedUser,
  ) {
    await this.findOne(eventId, zoneId);
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);

    const tier = await this.prisma.eventZonePriceTier.findFirst({
      where: {
        id: tierId,
        eventZoneId: zoneId,
      },
    });

    if (!tier) {
      throw new NotFoundException(`PriceTier ${tierId} no existe`);
    }

    // sortOrder 0 es la etapa "Regular" que create()/update() generan y
    // mantienen junto con eventPrice: borrarla por aquí dejaría la zona sin
    // su etapa base.
    if (tier.sortOrder === 0) {
      throw new ConflictException(
        'No se puede eliminar la etapa de precio base de la zona (sortOrder 0)',
      );
    }

    await this.prisma.eventZonePriceTier.delete({
      where: {
        id: tierId,
      },
    });

    await this.invalidateEventCache(eventId);

    return {
      deleted: true,
    };
  }

  async remove(eventId: string, zoneId: string, user: AuthenticatedUser) {
    const zone = await this.findOne(eventId, zoneId);
    const event = await this.findEvent(eventId);
    this.assertOwnerOrAdmin(event, user);

    this.validateEventEditable(event.status);

    const occupiedSeats =
      await this.prisma.eventSeat.count({
        where: {
          eventZoneId: zoneId,
          status: {
            in: [
              EventSeatStatus.RESERVED,
              EventSeatStatus.SOLD,
            ],
          },
        },
      });

    if (occupiedSeats > 0) {
      throw new ConflictException(
        'No se puede eliminar una zona con asientos reservados o vendidos',
      );
    }

    await this.prisma.$transaction([
      this.prisma.eventSeat.deleteMany({
        where: {
          eventZoneId: zoneId,
        },
      }),
      this.prisma.eventZonePriceTier.deleteMany({
        where: {
          eventZoneId: zoneId,
        },
      }),
      this.prisma.eventZoneSection.deleteMany({
        where: {
          eventZoneId: zoneId,
        },
      }),
      this.prisma.eventZone.delete({
        where: {
          id: zone.id,
        },
      }),
    ]);

    await this.invalidateEventCache(eventId);

    return {
      deleted: true,
    };
  }

  /**
   * Uso interno: purchases-service llama esto tras confirmar una compra de
   * boletos GENERAL. Una zona GENERAL no tiene EventSeat que marcar SOLD
   * (no hay asiento puntual que vender), así que el aforo se descuenta
   * directo de EventZone.availableCapacity. Se limita a la capacidad que
   * de verdad queda para nunca dejarla en negativo.
   */
  async markGeneralSoldForPurchase(
    eventId: string,
    zoneId: string,
    quantity: number,
  ) {
    const zone = await this.prisma.eventZone.findFirst({
      where: { id: zoneId, eventId },
    });

    if (!zone) {
      throw new NotFoundException(
        `EventZone ${zoneId} no existe en el evento ${eventId}`,
      );
    }

    const decrementBy = Math.min(quantity, zone.availableCapacity);
    if (decrementBy > 0) {
      await this.prisma.eventZone.update({
        where: { id: zoneId },
        data: { availableCapacity: { decrement: decrementBy } },
      });
      await this.invalidateEventCache(eventId);
    }

    return { updated: decrementBy };
  }

  private async findEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: {
        id: eventId,
      },
    });

    if (!event) {
      throw new NotFoundException(
        `Event ${eventId} no existe`,
      );
    }

    return event;
  }

  private async validateSections(
    venueId: string,
    eventId: string,
    sectionIds: string[],
  ) {
    const sections = await this.prisma.section.findMany({
      where: {
        id: {
          in: sectionIds,
        },
      },
    });

    if (sections.length !== sectionIds.length) {
      throw new NotFoundException(
        'Una o más secciones no existen',
      );
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
      (section) =>
        section.status !== SectionStatus.ACTIVE,
    );

    if (inactiveSection) {
      throw new ConflictException(
        `La sección ${inactiveSection.id} no está activa`,
      );
    }

    const assignedSections =
      await this.prisma.eventZoneSection.findMany({
        where: {
          eventId,
          sectionId: {
            in: sectionIds,
          },
        },
      });

    if (assignedSections.length > 0) {
      throw new ConflictException(
        'Una o más secciones ya pertenecen a otra zona del evento',
      );
    }
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

  private validateTierDateWindow(
    startsAt?: string,
    endsAt?: string,
  ) {
    if (!startsAt || !endsAt) {
      return;
    }

    const startDate = new Date(startsAt);
    const endDate = new Date(endsAt);

    if (startDate >= endDate) {
      throw new BadRequestException(
        'La fecha inicial del precio debe ser anterior a la fecha final',
      );
    }
  }

  private zoneInclude() {
    return {
      priceTiers: {
        orderBy: {
          sortOrder: 'asc' as const,
        },
      },
      sections: {
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
        },
      },
      eventSeats: {
        select: {
          id: true,
          status: true,
          lockedUntil: true,
          sectionId: true,
          seat: {
            select: {
              id: true,
              row: true,
              number: true,
              type: true,
            },
          },
        },
      },
    };
  }

  private async invalidateEventCache(eventId: string) {
    await this.redis.del('events:list');
    await this.redis.del(`events:${eventId}`);
    await this.redis.del('catalog:events');
    await this.redis.del(`catalog:events:${eventId}`);
  }
}