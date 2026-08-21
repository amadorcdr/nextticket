import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, QueueEntryStatus, TemporaryBlock } from '@prisma/client';
import { AUTH_ROLES } from '../auth/auth.constants';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { buildAdmissionKey } from '../event-queue/admission-key.util';
import { PurchasesGateway } from './purchases.gateway';
import {
  CreatePurchaseDto,
  PurchaseDetailDto,
  SimulatedPaymentDto,
  SimulatedPaymentMethod,
} from './dto/create-purchase.dto';
import { CreateTemporaryBlockDto } from './dto/create-temporary-block.dto';
import { PurchaseZoneRevenueDto, PurchasesStatsResponseDto } from './dto/purchases-stats-response.dto';
import { PurchasesStatsQueryDto } from './dto/purchases-stats-query.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  buildPaginatedResponse,
  isCacheablePage,
  toPrismaPagination,
} from '../common/pagination.helper';

const LIST_CACHE_KEY = 'purchases:list';
const STATS_CACHE_KEY = 'purchases:stats';
const SEAT_HOLD_TTL_SECONDS = Number(process.env.SEAT_HOLD_TTL_SECONDS ?? 8 * 60);
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

type PaymentDecision = {
  approved: boolean;
  status: 'APPROVED' | 'REJECTED';
  externalReference: string;
};

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: PurchasesGateway,
  ) {}

  async createTemporaryBlock(dto: CreateTemporaryBlockDto, userId: string) {
    await this.assertHasActiveAdmission(dto.eventId, userId);

    if (dto.eventSeatIds?.length) {
      return this.createReservedSeatBlocks(dto, userId);
    }
    return this.createGeneralAdmissionBlock(dto, userId);
  }

  /** Módulo 8 → Módulo 7: sin turno vigente en la fila virtual no hay hold. */
  private async assertHasActiveAdmission(eventId: string, userId: string) {
    const admission = await this.redis.get(buildAdmissionKey(eventId, userId));
    if (!admission) {
      throw new ForbiddenException(
        'Debes tener un turno vigente en la fila virtual de este evento para bloquear asientos',
      );
    }
  }

  private async createGeneralAdmissionBlock(
    dto: CreateTemporaryBlockDto,
    userId: string,
  ) {
    const quantity = dto.quantity ?? 1;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + SEAT_HOLD_TTL_SECONDS * 1000);
    const holdGroupId = randomUUID();
    const lockKey = this.buildBlockKey(dto.eventZoneId);

    const lockPayload = {
      userId,
      eventZoneId: dto.eventZoneId,
      eventSeatId: null,
      quantity,
      lockedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const acquired = await this.redis.setIfAbsent(
      lockKey,
      lockPayload,
      SEAT_HOLD_TTL_SECONDS,
    );
    if (!acquired) {
      throw new ConflictException(
        'La zona ya tiene un bloqueo de admisión general activo',
      );
    }

    try {
      const block = await this.prisma.temporaryBlock.create({
        data: {
          userId,
          eventZoneId: dto.eventZoneId,
          quantity,
          startedAt,
          expiresAt,
          holdGroupId,
        },
      });

      this.gateway.emitBlockLocked({
        blockId: block.id,
        eventZoneId: block.eventZoneId,
        eventSeatId: block.eventSeatId,
      });

      return this.toHoldResponse(holdGroupId, dto, [block], expiresAt);
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
  }

  /**
   * Bloquea uno o varios asientos reservados de forma atómica: si CUALQUIERA
   * ya está bloqueado, vendido o no es vendible, no se bloquea NINGUNO
   * (evita quedar con A1/A2 apartados y A3 sin apartar).
   */
  private async createReservedSeatBlocks(
    dto: CreateTemporaryBlockDto,
    userId: string,
  ) {
    const eventSeatIds = dto.eventSeatIds as string[];
    await this.assertSeatsAreVendible(dto.eventId, eventSeatIds, dto.eventZoneId);

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + SEAT_HOLD_TTL_SECONDS * 1000);
    const holdGroupId = randomUUID();

    const keys = eventSeatIds.map((seatId) =>
      this.buildBlockKey(dto.eventZoneId, seatId),
    );
    const payloads = eventSeatIds.map((seatId) => ({
      userId,
      eventZoneId: dto.eventZoneId,
      eventSeatId: seatId,
      quantity: 1,
      lockedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }));

    const acquired = await this.redis.acquireMultiLock(
      keys,
      SEAT_HOLD_TTL_SECONDS,
      payloads,
    );
    if (!acquired) {
      throw new ConflictException(
        'Uno o más asientos ya están bloqueados o vendidos; no se bloqueó ninguno',
      );
    }

    try {
      const blocks = await this.prisma.$transaction(
        eventSeatIds.map((seatId) =>
          this.prisma.temporaryBlock.create({
            data: {
              userId,
              eventZoneId: dto.eventZoneId,
              eventSeatId: seatId,
              quantity: 1,
              startedAt,
              expiresAt,
              holdGroupId,
            },
          }),
        ),
      );

      for (const block of blocks) {
        this.gateway.emitBlockLocked({
          blockId: block.id,
          eventZoneId: block.eventZoneId,
          eventSeatId: block.eventSeatId,
        });
      }

      return this.toHoldResponse(holdGroupId, dto, blocks, expiresAt);
    } catch (error) {
      await this.redis.delMany(keys);
      throw error;
    }
  }

  /**
   * Nunca confía en los eventSeatId que manda el cliente: verifica contra
   * venues-events-service que cada asiento exista y esté realmente AVAILABLE.
   * `eventZoneId` es opcional: al crear un hold se exige que además
   * pertenezca a esa zona (un hold es de una sola zona); al confirmar una
   * compra los asientos pueden venir de varias zonas (un hold por zona), así
   * que ahí solo importa existencia + disponibilidad.
   */
  private async assertSeatsAreVendible(
    eventId: string,
    eventSeatIds: string[],
    eventZoneId?: string,
  ) {
    if (eventSeatIds.length === 0) return;

    const baseUrl = process.env.VENUES_EVENTS_URL ?? 'http://localhost:3003';
    const ids = eventSeatIds.join(',');

    let response: Response;
    try {
      response = await fetch(
        `${baseUrl}/events/${eventId}/seats/by-event-seat-ids?ids=${encodeURIComponent(ids)}`,
      );
    } catch {
      throw new ServiceUnavailableException(
        'No se pudieron verificar los asientos (venues-events-service no responde)',
      );
    }
    if (!response.ok) {
      throw new BadRequestException('No se pudieron verificar los asientos solicitados');
    }

    const seats = (await response.json()) as Array<{
      id: string;
      eventZoneId: string;
      status: string;
    }>;
    const byId = new Map(seats.map((seat) => [seat.id, seat]));

    for (const seatId of eventSeatIds) {
      const seat = byId.get(seatId);
      if (!seat) {
        throw new NotFoundException(`El asiento ${seatId} no existe en este evento`);
      }
      if (eventZoneId && seat.eventZoneId !== eventZoneId) {
        throw new BadRequestException(
          `El asiento ${seatId} no pertenece a la zona indicada`,
        );
      }
      if (seat.status !== 'AVAILABLE') {
        throw new ConflictException(
          `El asiento ${seatId} no está disponible (status=${seat.status})`,
        );
      }
    }
  }

  /**
   * El precio nunca se toma de lo que manda el Cliente: se vuelve a
   * consultar el evento real en venues-events-service y se usa
   * eventZone.eventPrice como precio unitario autoritativo por zona.
   */
  private async resolveAuthoritativePrices(
    eventId: string,
    zoneIds: string[],
  ): Promise<Map<string, number>> {
    const baseUrl = process.env.VENUES_EVENTS_URL ?? 'http://localhost:3003';

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/events/${eventId}`);
    } catch {
      throw new ServiceUnavailableException(
        'No se pudo verificar el evento (venues-events-service no responde)',
      );
    }
    if (response.status === 404) {
      throw new NotFoundException(`Event ${eventId} no existe`);
    }
    if (!response.ok) {
      throw new NotFoundException('No se pudo verificar el evento');
    }

    const event = (await response.json()) as {
      status: string;
      zones: Array<{ id: string; eventPrice: string | number }>;
    };

    // Defensa en profundidad: el catálogo del cliente ya no lista eventos
    // cancelados, pero esta ruta es la que de verdad mueve dinero — no debe
    // depender solo de que el frontend se porte bien.
    if (event.status === 'CANCELED') {
      throw new BadRequestException('Este evento fue cancelado y ya no admite compras');
    }

    const priceByZone = new Map(
      event.zones.map((zone) => [zone.id, Number(zone.eventPrice)]),
    );

    for (const zoneId of zoneIds) {
      if (!priceByZone.has(zoneId)) {
        throw new BadRequestException(
          `La zona ${zoneId} no pertenece a este evento`,
        );
      }
    }

    return priceByZone;
  }

  /**
   * Best-effort, igual que issueTicketsForPurchase: el pago ya se aprobó y
   * la compra ya quedó CONFIRMED, así que un fallo aquí no debe tumbar la
   * respuesta — pero SÍ debe quedar registrado, porque mientras no corra
   * esto el asiento sigue viéndose AVAILABLE en venues-events-service.
   */
  private async markSeatsSold(eventId: string, eventSeatIds: string[]) {
    if (eventSeatIds.length === 0) return;

    const baseUrl = process.env.VENUES_EVENTS_URL ?? 'http://localhost:3003';
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? '';

    try {
      const response = await fetch(
        `${baseUrl}/events/${eventId}/seats/internal/mark-sold`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Service-Token': internalToken,
          },
          body: JSON.stringify({ eventSeatIds }),
        },
      );
      if (!response.ok) {
        throw new Error(`venues-events-service respondió ${response.status}`);
      }
    } catch (error) {
      this.logger.error(
        `No se pudieron marcar como vendidos los asientos [${eventSeatIds.join(', ')}] del evento ${eventId}: ${String(error)}`,
      );
    }
  }

  /**
   * Igual que markSeatsSold, pero para zonas GENERAL: no hay eventSeatId
   * puntual que marcar (el comprador no eligió un asiento específico), así
   * que se descuenta el aforo de la zona directo por cantidad. Best-effort:
   * un fallo aquí no debe tumbar la compra ya confirmada.
   */
  private async markGeneralAdmissionSold(
    eventId: string,
    details: { eventZoneId: string; eventSeatId?: string | null }[],
  ) {
    const quantityByZone = new Map<string, number>();
    for (const detail of details) {
      if (detail.eventSeatId) continue;
      quantityByZone.set(
        detail.eventZoneId,
        (quantityByZone.get(detail.eventZoneId) ?? 0) + 1,
      );
    }
    if (quantityByZone.size === 0) return;

    const baseUrl = process.env.VENUES_EVENTS_URL ?? 'http://localhost:3003';
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? '';

    await Promise.all(
      [...quantityByZone.entries()].map(async ([eventZoneId, quantity]) => {
        try {
          const response = await fetch(
            `${baseUrl}/events/${eventId}/zones/${eventZoneId}/internal/mark-general-sold`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Internal-Service-Token': internalToken,
              },
              body: JSON.stringify({ quantity }),
            },
          );
          if (!response.ok) {
            throw new Error(`venues-events-service respondió ${response.status}`);
          }
        } catch (error) {
          this.logger.error(
            `No se pudo descontar aforo GENERAL (zone=${eventZoneId} qty=${quantity}) del evento ${eventId}: ${String(error)}`,
          );
        }
      }),
    );
  }

  private toHoldResponse(
    holdGroupId: string,
    dto: CreateTemporaryBlockDto,
    blocks: TemporaryBlock[],
    expiresAt: Date,
  ) {
    return {
      holdId: holdGroupId,
      eventId: dto.eventId,
      eventZoneId: dto.eventZoneId,
      status: 'HELD' as const,
      expiresAt,
      blocks: blocks.map((block) => ({
        blockId: block.id,
        eventSeatId: block.eventSeatId,
        quantity: block.quantity,
      })),
    };
  }

  async findActiveBlocksByUser(userId: string) {
    await this.expireElapsedBlocks();
    const blocks = await this.prisma.temporaryBlock.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { expiresAt: 'asc' },
    });

    return Promise.all(
      blocks.map(async (block) => ({
        ...block,
        ttlSeconds: await this.redis.ttl(
          this.buildBlockKey(block.eventZoneId, block.eventSeatId ?? undefined),
        ),
      })),
    );
  }

  async releaseTemporaryBlock(id: string, userId: string) {
    const block = await this.prisma.temporaryBlock.findUnique({
      where: { id },
    });
    if (!block)
      throw new NotFoundException(`Temporary block ${id} does not exist`);

    if (block.userId !== userId) {
      throw new BadRequestException(
        'Temporary block does not belong to the authenticated user',
      );
    }

    await this.redis.del(
      this.buildBlockKey(block.eventZoneId, block.eventSeatId ?? undefined),
    );

    const released = await this.prisma.temporaryBlock.update({
      where: { id },
      data: { status: 'RELEASED' },
    });

    this.gateway.emitBlockReleased({
      blockId: released.id,
      eventZoneId: released.eventZoneId,
      eventSeatId: released.eventSeatId,
    });

    return released;
  }

  async create(dto: CreatePurchaseDto, userId: string) {
    await this.expireElapsedBlocks();
    await this.assertBlocksCanBeConverted(dto, userId);

    const seatIds = dto.details
      .map((detail) => detail.eventSeatId)
      .filter((id): id is string => Boolean(id));
    await this.assertSeatsAreVendible(dto.eventId, seatIds);

    const zoneIds = [...new Set(dto.details.map((detail) => detail.eventZoneId))];
    const priceByZone = await this.resolveAuthoritativePrices(dto.eventId, zoneIds);
    // El unitPrice que mandó el cliente se descarta: el precio real de la
    // zona es la única fuente de verdad (sección 21 del TODO de checkout).
    const authoritativeDetails = dto.details.map((detail) => ({
      ...detail,
      unitPrice: priceByZone.get(detail.eventZoneId)!,
    }));

    const totals = this.calculateTotals(authoritativeDetails);
    const paymentDecision = this.simulatePayment(dto.payment);

    const purchase = await this.prisma.$transaction(async (tx) => {
      const folio = paymentDecision.approved
        ? await this.nextPurchaseFolio(tx)
        : null;

      const createdPurchase = await tx.purchase.create({
        data: {
          userId,
          eventId: dto.eventId,
          folio,
          grossSubtotal: totals.grossSubtotal,
          discountAmount: totals.discountAmount,
          netSubtotal: totals.netSubtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          status: paymentDecision.approved ? 'CONFIRMED' : 'CANCELED',
          details: {
            create: authoritativeDetails.map((detail) =>
              this.toPurchaseDetailCreateInput(detail),
            ),
          },
          payments: {
            create: {
              amount: totals.total,
              paymentMethod: dto.payment.paymentMethod,
              externalReference: paymentDecision.externalReference,
              status: paymentDecision.status,
            },
          },
        },
        include: {
          details: true,
          payments: true,
        },
      });

      if (dto.temporaryBlockIds?.length) {
        await tx.temporaryBlock.updateMany({
          where: { id: { in: dto.temporaryBlockIds }, userId },
          data: { status: paymentDecision.approved ? 'CONVERTED' : 'RELEASED' },
        });
      }

      return createdPurchase;
    });

    if (dto.temporaryBlockIds?.length) {
      await this.releaseRedisLocksForBlocks(
        dto.temporaryBlockIds,
        paymentDecision.approved,
      );
    }
    await this.redis.del(LIST_CACHE_KEY);
    await this.redis.del(STATS_CACHE_KEY);
    await this.redis.del(this.eventStatsCacheKey(dto.eventId));

    if (!paymentDecision.approved) {
      return {
        ...purchase,
        paymentResult: {
          approved: false,
          status: paymentDecision.status,
          message: 'Simulated payment was rejected',
        },
      };
    }

    await this.markSeatsSold(dto.eventId, seatIds);
    await this.markGeneralAdmissionSold(dto.eventId, authoritativeDetails);
    // El comprador ya terminó lo que la fila virtual estaba protegiendo: no
    // tiene sentido dejarle el cupo ocupado hasta que venza el TTL completo
    // (hasta QUEUE_ADMISSION_TTL_SECONDS) — se libera de inmediato para que
    // el siguiente en espera entre sin esperar de más.
    await this.releaseQueueAdmission(dto.eventId, userId);
    const tickets = await this.issueTicketsForPurchase(purchase);

    return {
      ...purchase,
      tickets,
      paymentResult: {
        approved: true,
        status: paymentDecision.status,
        message: 'Simulated payment approved',
      },
    };
  }

  /**
   * Libera el turno de la fila virtual (Módulo 8) en cuanto se confirma la
   * compra, en vez de dejarlo ocupado hasta que venza el TTL de admisión.
   * Best-effort: si falla, el turno igual se libera solo por el cron de
   * event-queue.scheduler.ts al vencer, así que no debe tumbar la compra
   * ya confirmada.
   */
  private async releaseQueueAdmission(eventId: string, userId: string) {
    try {
      await this.prisma.queueEntry.updateMany({
        where: {
          eventId,
          userId,
          status: { in: [QueueEntryStatus.WAITING, QueueEntryStatus.ADMITTED] },
        },
        data: { status: QueueEntryStatus.CANCELED },
      });
      await this.redis.del(buildAdmissionKey(eventId, userId));
    } catch (error) {
      this.logger.warn(
        `No se pudo liberar el turno de fila virtual (event=${eventId} user=${userId}): ${error}`,
      );
    }
  }

  /**
   * Un ticket por PurchaseDetail, emitido por tickets-service a nombre del
   * comprador real (purchase.userId). El pago simulado ya se marcó como
   * aprobado y la compra ya quedó CONFIRMED en esta misma llamada — no hay
   * forma de "deshacer" eso si la emisión falla, así que es best-effort:
   * se intenta emitir cada ticket, los que fallan quedan registrados en el
   * log (nunca silenciosos) y la compra igual se devuelve. issueForPurchase
   * es idempotente del lado de tickets-service, así que reintentar esta
   * llamada más adelante (p. ej. desde un job de reconciliación) es seguro.
   */
  private async issueTicketsForPurchase(purchase: {
    id: string;
    userId: string;
    details: { id: string; eventZoneId: string; eventSeatId: string | null }[];
  }) {
    const baseUrl = process.env.TICKETS_SERVICE_URL ?? 'http://localhost:3005';
    const internalToken = process.env.INTERNAL_SERVICE_TOKEN ?? '';

    const results = await Promise.allSettled(
      purchase.details.map(async (detail) => {
        const response = await fetch(
          `${baseUrl}/tickets/internal/issue-for-purchase`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Service-Token': internalToken,
            },
            body: JSON.stringify({
              purchaseId: purchase.id,
              purchaseDetailId: detail.id,
              currentHolderId: purchase.userId,
              eventZoneId: detail.eventZoneId,
              eventSeatId: detail.eventSeatId ?? undefined,
            }),
          },
        );
        if (!response.ok) {
          throw new Error(
            `tickets-service respondió ${response.status} para purchaseDetail=${detail.id}`,
          );
        }
        return response.json();
      }),
    );

    const tickets: unknown[] = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        tickets.push(result.value);
      } else {
        this.logger.error(
          `No se pudo emitir el ticket para purchase=${purchase.id} purchaseDetail=${purchase.details[index].id}: ${String(result.reason)}`,
        );
      }
    });

    return tickets;
  }

  async findAll(
    pagination: PaginationQueryDto,
    requester: AuthenticatedUser,
    eventId?: string,
  ) {
    const isAdmin = requester.role === AUTH_ROLES.ADMIN;

    // El ORGANIZER puede ver TODAS las compras de un evento (no solo las
    // propias), pero únicamente si ese evento es suyo.
    const isOrganizerViewingOwnEvent =
      !isAdmin && requester.role === AUTH_ROLES.ORGANIZER && Boolean(eventId);

    if (isOrganizerViewingOwnEvent) {
      await this.assertOrganizerOwnsEvent(eventId as string, requester.sub);
    }

    // Cada quien ve solo sus compras; el ADMIN ve todas; el ORGANIZER ve
    // todas las de su propio evento (ya verificado arriba).
    const where = {
      ...(isAdmin || isOrganizerViewingOwnEvent ? {} : { userId: requester.sub }),
      ...(eventId ? { eventId } : {}),
    };

    /*
     * La llave de caché es única para todo el servicio, así que solo se
     * cachea la vista global del ADMIN sin filtros. Si cacheáramos la de
     * cada usuario o de un eventId bajo esa misma llave, se mezclarían
     * resultados de vistas distintas.
     */
    const useCache = isAdmin && isCacheablePage(pagination) && !eventId;

    if (useCache) {
      const cached =
        await this.redis.get<PaginatedResponseDto<unknown>>(LIST_CACHE_KEY);
      if (cached) return cached;
    }

    const { skip, take } = toPrismaPagination(pagination);
    const [purchases, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        skip,
        take,
        where,
        include: { details: true, payments: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchase.count({ where }),
    ]);

    const response = buildPaginatedResponse(purchases, total, pagination);

    if (useCache) await this.redis.set(LIST_CACHE_KEY, response, 30);
    return response;
  }

  async getStats(
    requester: AuthenticatedUser,
    query: PurchasesStatsQueryDto = {},
  ): Promise<PurchasesStatsResponseDto> {
    const { eventId, from, to } = query;

    if (requester.role !== AUTH_ROLES.ADMIN) {
      // Un ORGANIZER solo puede pedir las métricas de UN evento (el suyo),
      // nunca las globales de la plataforma.
      if (!eventId) {
        throw new ForbiddenException(
          'Debes indicar un eventId para consultar estas métricas',
        );
      }
      await this.assertOrganizerOwnsEvent(eventId, requester.sub);
    }

    const hasPeriod = Boolean(from || to);

    // Las consultas por periodo son puntuales y cada rango daría un resultado
    // distinto: cachearlas bajo la clave global devolvería el acumulado.
    const cacheKey = eventId ? this.eventStatsCacheKey(eventId) : STATS_CACHE_KEY;
    if (!hasPeriod) {
      const cached = await this.redis.get<PurchasesStatsResponseDto>(cacheKey);
      if (cached) return cached;
    }

    const periodFilter = hasPeriod
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {};

    const since = new Date(Date.now() - RECENT_WINDOW_MS);
    const revenueWhere = {
      status: 'CONFIRMED' as const,
      ...(eventId ? { eventId } : {}),
      ...periodFilter,
    };
    // Con periodo explícito, "recientes" pasa a significar "del periodo":
    // preguntar por mayo y recibir el conteo de las últimas 24 h no tendría
    // sentido para quien consulta.
    const recentWhere = hasPeriod
      ? { ...(eventId ? { eventId } : {}), ...periodFilter }
      : { createdAt: { gte: since }, ...(eventId ? { eventId } : {}) };

    const [revenueAggregate, recentPurchasesCount, zoneRevenue] =
      await Promise.all([
        this.prisma.purchase.aggregate({
          _sum: { total: true },
          where: revenueWhere,
        }),
        this.prisma.purchase.count({ where: recentWhere }),
        eventId
          ? this.prisma.purchaseDetail.groupBy({
              by: ['eventZoneId'],
              where: {
                purchase: { eventId, status: 'CONFIRMED', ...periodFilter },
              },
              _sum: { finalPrice: true, taxAmount: true },
              _count: { _all: true },
            })
          : Promise.resolve(null),
      ]);

    const byEventZone: PurchaseZoneRevenueDto[] | undefined = zoneRevenue
      ? zoneRevenue.map((zone) => ({
          eventZoneId: zone.eventZoneId,
          revenue:
            Number(zone._sum.finalPrice ?? 0) + Number(zone._sum.taxAmount ?? 0),
          // Cada PurchaseDetail es un boleto, así que contarlos es contar
          // los boletos vendidos de la zona.
          ticketsSold: zone._count._all,
        }))
      : undefined;

    const stats: PurchasesStatsResponseDto = {
      totalRevenue: Number(revenueAggregate._sum.total ?? 0),
      recentPurchasesCount,
      ...(byEventZone ? { byEventZone } : {}),
      from: from ?? null,
      to: to ?? null,
    };

    if (!hasPeriod) {
      await this.redis.set(cacheKey, stats, 30);
    }

    return stats;
  }

  private eventStatsCacheKey(eventId: string) {
    return `purchases:stats:event:${eventId}`;
  }

  /**
   * eventId es un id "opaco" a venues-events-service (microservicios
   * separados, sin FK): para saber si el evento es del ORGANIZER que
   * pregunta, se le pide directo a ese servicio por su endpoint público
   * GET /events/:id (no requiere auth) y se compara organizerId.
   */
  private async assertOrganizerOwnsEvent(eventId: string, organizerId: string) {
    const baseUrl = process.env.VENUES_EVENTS_URL ?? 'http://localhost:3003';

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/events/${eventId}`);
    } catch {
      throw new NotFoundException(
        'No se pudo verificar el evento (venues-events-service no responde)',
      );
    }

    if (response.status === 404) {
      throw new NotFoundException(`Event ${eventId} no existe`);
    }
    if (!response.ok) {
      throw new NotFoundException('No se pudo verificar el evento');
    }

    const event = (await response.json()) as { organizerId?: string };

    if (event.organizerId !== organizerId) {
      throw new ForbiddenException(
        'Solo puedes consultar las compras de tus propios eventos',
      );
    }
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { details: true, payments: true },
    });
    if (!purchase) throw new NotFoundException(`Purchase ${id} does not exist`);

    if (
      purchase.userId !== requester.sub &&
      requester.role !== AUTH_ROLES.ADMIN
    ) {
      throw new ForbiddenException('Solo puedes consultar tus propias compras');
    }

    return purchase;
  }

  async update(id: string, dto: UpdatePurchaseDto, userId: string) {
    const existing = await this.assertPurchaseBelongsToUser(id, userId);
    const purchase = await this.prisma.purchase.update({
      where: { id },
      data: dto,
      include: { details: true, payments: true },
    });
    await this.redis.del(LIST_CACHE_KEY);
    await this.redis.del(STATS_CACHE_KEY);
    await this.redis.del(this.eventStatsCacheKey(existing.eventId));
    return purchase;
  }

  async remove(id: string, userId: string) {
    const existing = await this.assertPurchaseBelongsToUser(id, userId);
    await this.prisma.purchase.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
    await this.redis.del(LIST_CACHE_KEY);
    await this.redis.del(STATS_CACHE_KEY);
    await this.redis.del(this.eventStatsCacheKey(existing.eventId));
    return { canceled: true };
  }

  /** La identidad viene del token, nunca del body ni de la ruta. */
  private async assertPurchaseBelongsToUser(id: string, userId: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: { details: true, payments: true },
    });

    if (!purchase) throw new NotFoundException(`Purchase ${id} does not exist`);

    if (purchase.userId !== userId) {
      throw new ForbiddenException('Purchase does not belong to the authenticated user');
    }

    return purchase;
  }

  async expireElapsedBlocks() {
    const now = new Date();
    const elapsed = await this.prisma.temporaryBlock.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lte: now },
      },
    });

    if (elapsed.length === 0) return { count: 0 };

    const result = await this.prisma.temporaryBlock.updateMany({
      where: { id: { in: elapsed.map((block) => block.id) } },
      data: { status: 'EXPIRED' },
    });

    for (const block of elapsed) {
      this.gateway.emitBlockExpired({
        blockId: block.id,
        eventZoneId: block.eventZoneId,
        eventSeatId: block.eventSeatId,
      });
    }

    return result;
  }

  private async assertBlocksCanBeConverted(dto: CreatePurchaseDto, userId: string) {
    if (!dto.temporaryBlockIds?.length) return;

    const blocks = await this.prisma.temporaryBlock.findMany({
      where: { id: { in: dto.temporaryBlockIds } },
    });

    if (blocks.length !== dto.temporaryBlockIds.length) {
      throw new BadRequestException(
        'One or more temporary blocks do not exist',
      );
    }

    const now = Date.now();
    for (const block of blocks) {
      if (block.userId !== userId) {
        throw new BadRequestException(
          'Temporary block does not belong to the user',
        );
      }
      if (block.status !== 'ACTIVE' || block.expiresAt.getTime() <= now) {
        throw new BadRequestException('Temporary block is not active');
      }
      if (
        !dto.details.some(
          (detail) =>
            detail.eventZoneId === block.eventZoneId &&
            (block.eventSeatId === null ||
              detail.eventSeatId === block.eventSeatId),
        )
      ) {
        throw new BadRequestException(
          'Purchase details do not match the temporary blocks',
        );
      }
    }
  }

  private calculateTotals(details: PurchaseDetailDto[]) {
    const totals = details.reduce(
      (acc, detail) => {
        const unitPrice = this.toCents(detail.unitPrice);
        const discountAmount = this.toCents(detail.discountAmount ?? 0);
        const taxAmount = this.toCents(detail.taxAmount ?? 0);
        const finalPrice = unitPrice - discountAmount;

        if (finalPrice < 0) {
          throw new BadRequestException(
            'Discount cannot be greater than unit price',
          );
        }

        return {
          grossSubtotal: acc.grossSubtotal + unitPrice,
          discountAmount: acc.discountAmount + discountAmount,
          netSubtotal: acc.netSubtotal + finalPrice,
          taxAmount: acc.taxAmount + taxAmount,
          total: acc.total + finalPrice + taxAmount,
        };
      },
      {
        grossSubtotal: 0,
        discountAmount: 0,
        netSubtotal: 0,
        taxAmount: 0,
        total: 0,
      },
    );

    return {
      grossSubtotal: this.fromCents(totals.grossSubtotal),
      discountAmount: this.fromCents(totals.discountAmount),
      netSubtotal: this.fromCents(totals.netSubtotal),
      taxAmount: this.fromCents(totals.taxAmount),
      total: this.fromCents(totals.total),
    };
  }

  private toPurchaseDetailCreateInput(detail: PurchaseDetailDto) {
    const unitPrice = this.toCents(detail.unitPrice);
    const discountAmount = this.toCents(detail.discountAmount ?? 0);
    const taxAmount = this.toCents(detail.taxAmount ?? 0);
    const finalPrice = unitPrice - discountAmount;

    return {
      eventZoneId: detail.eventZoneId,
      eventSeatId: detail.eventSeatId,
      priceTierId: detail.priceTierId,
      promoCodeUsageId: detail.promoCodeUsageId,
      unitPrice: this.fromCents(unitPrice),
      discountAmount: this.fromCents(discountAmount),
      finalPrice: this.fromCents(finalPrice),
      taxAmount: this.fromCents(taxAmount),
      quantity: 1,
      subtotal: this.fromCents(finalPrice),
    };
  }

  private simulatePayment(payment: SimulatedPaymentDto): PaymentDecision {
    if (
      payment.paymentMethod === SimulatedPaymentMethod.CREDIT_CARD ||
      payment.paymentMethod === SimulatedPaymentMethod.DEBIT_CARD
    ) {
      this.assertCardData(payment);

      if (payment.cardNumber?.startsWith('400000')) {
        return {
          approved: false,
          status: 'REJECTED',
          externalReference: 'SIM-DECLINED',
        };
      }

      if (payment.cardNumber?.startsWith('510510')) {
        return {
          approved: false,
          status: 'REJECTED',
          externalReference: 'SIM-INSUFFICIENT-FUNDS',
        };
      }
    }

    return {
      approved: true,
      status: 'APPROVED',
      externalReference: `SIM-${Date.now()}`,
    };
  }

  private assertCardData(payment: SimulatedPaymentDto) {
    if (
      !payment.cardholderName ||
      !payment.cardNumber ||
      !payment.expirationMonth ||
      !payment.expirationYear ||
      !payment.cvv
    ) {
      throw new BadRequestException('Card data is required for card payments');
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const expired =
      payment.expirationYear < currentYear ||
      (payment.expirationYear === currentYear &&
        payment.expirationMonth < currentMonth);

    if (expired) {
      throw new BadRequestException(
        'Card expiration date must be in the future',
      );
    }
  }

  private async nextPurchaseFolio(
    tx: Prisma.TransactionClient,
  ): Promise<bigint> {
    const [{ nextval }] = await tx.$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval('purchase_folio_seq')`;
    return nextval;
  }

  private async releaseRedisLocksForBlocks(
    blockIds: string[],
    approved: boolean,
  ) {
    const blocks = await this.prisma.temporaryBlock.findMany({
      where: { id: { in: blockIds } },
    });

    await Promise.all(
      blocks.map((block) =>
        this.redis.del(
          this.buildBlockKey(block.eventZoneId, block.eventSeatId ?? undefined),
        ),
      ),
    );

    for (const block of blocks) {
      const payload = {
        blockId: block.id,
        eventZoneId: block.eventZoneId,
        eventSeatId: block.eventSeatId,
      };
      if (approved) {
        this.gateway.emitBlockConverted(payload);
      } else {
        this.gateway.emitBlockReleased(payload);
      }
    }
  }

  private buildBlockKey(eventZoneId: string, eventSeatId?: string) {
    if (eventSeatId) return `event-zone:${eventZoneId}:seat:${eventSeatId}`;
    return `event-zone:${eventZoneId}:general-admission`;
  }

  private toCents(value: number) {
    return Math.round(value * 100);
  }

  private fromCents(value: number) {
    return value / 100;
  }
}
