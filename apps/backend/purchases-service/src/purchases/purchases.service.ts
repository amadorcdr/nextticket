import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AUTH_ROLES } from '../auth/auth.constants';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PurchasesGateway } from './purchases.gateway';
import {
  CreatePurchaseDto,
  PurchaseDetailDto,
  SimulatedPaymentDto,
  SimulatedPaymentMethod,
} from './dto/create-purchase.dto';
import { CreateTemporaryBlockDto } from './dto/create-temporary-block.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  buildPaginatedResponse,
  isCacheablePage,
  toPrismaPagination,
} from '../common/pagination.helper';

const LIST_CACHE_KEY = 'purchases:list';
const BLOCK_TTL_SECONDS = 8 * 60;

type PaymentDecision = {
  approved: boolean;
  status: 'APPROVED' | 'REJECTED';
  externalReference: string;
};

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: PurchasesGateway,
  ) {}

  async createTemporaryBlock(dto: CreateTemporaryBlockDto, userId: string) {
    if (dto.eventSeatId && dto.quantity && dto.quantity > 1) {
      throw new BadRequestException(
        'quantity must be 1 when blocking a specific seat',
      );
    }

    const quantity = dto.eventSeatId ? 1 : (dto.quantity ?? 1);
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + BLOCK_TTL_SECONDS * 1000);
    const lockKey = this.buildBlockKey(dto.eventZoneId, dto.eventSeatId);

    const lockPayload = {
      userId,
      eventZoneId: dto.eventZoneId,
      eventSeatId: dto.eventSeatId ?? null,
      quantity,
      lockedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const acquired = await this.redis.setIfAbsent(
      lockKey,
      lockPayload,
      BLOCK_TTL_SECONDS,
    );
    if (!acquired) {
      throw new ConflictException(
        'Seat or zone is already temporarily blocked',
      );
    }

    try {
      const block = await this.prisma.temporaryBlock.create({
        data: {
          userId,
          eventZoneId: dto.eventZoneId,
          eventSeatId: dto.eventSeatId,
          quantity,
          startedAt,
          expiresAt,
        },
      });

      this.gateway.emitBlockLocked({
        blockId: block.id,
        eventZoneId: block.eventZoneId,
        eventSeatId: block.eventSeatId,
      });

      return block;
    } catch (error) {
      await this.redis.del(lockKey);
      throw error;
    }
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

    const totals = this.calculateTotals(dto.details);
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
            create: dto.details.map((detail) =>
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

    return {
      ...purchase,
      paymentResult: {
        approved: true,
        status: paymentDecision.status,
        message: 'Simulated payment approved',
      },
    };
  }

  async findAll(pagination: PaginationQueryDto, requester: AuthenticatedUser) {
    const isAdmin = requester.role === AUTH_ROLES.ADMIN;

    // Cada quien ve solo sus compras; el ADMIN ve todas.
    const where = isAdmin ? {} : { userId: requester.sub };

    /*
     * La llave de caché es única para todo el servicio, así que solo se
     * cachea la vista global del ADMIN. Si cacheáramos la de cada usuario
     * bajo esa misma llave, un usuario vería las compras de otro.
     */
    const useCache = isAdmin && isCacheablePage(pagination);

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
    await this.assertPurchaseBelongsToUser(id, userId);
    const purchase = await this.prisma.purchase.update({
      where: { id },
      data: dto,
      include: { details: true, payments: true },
    });
    await this.redis.del(LIST_CACHE_KEY);
    return purchase;
  }

  async remove(id: string, userId: string) {
    await this.assertPurchaseBelongsToUser(id, userId);
    await this.prisma.purchase.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
    await this.redis.del(LIST_CACHE_KEY);
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
