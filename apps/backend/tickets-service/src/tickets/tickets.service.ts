import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketsStatsResponseDto } from './dto/tickets-stats-response.dto';
import { AUTH_ROLES } from '../auth/auth.constants';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  buildPaginatedResponse,
  isCacheablePage,
  toPrismaPagination,
} from '../common/pagination.helper';

const LIST_CACHE_KEY = 'tickets:list';
const STATS_CACHE_KEY = 'tickets:stats';
const FOLIO_PREFIX = 'TK';
const SHA_256_HASH_REGEX = /^[a-fA-F0-9]{64}$/;

/**
 * El qrCode es la credencial de entrada al evento: quien lo tiene, entra.
 * Por eso nunca sale en listados ni cuando lo pide alguien que no es el
 * dueño del boleto.
 */
const HIDE_QR_CODE = { qrCode: true } as const;

function canSeeQrCode(ticketHolderId: string, requester: AuthenticatedUser) {
  return (
    requester.sub === ticketHolderId || requester.role === AUTH_ROLES.ADMIN
  );
}

@Injectable()
export class TicketsService {
  private readonly qrHashSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.qrHashSecret =
      config.get<string>('QR_HASH_SECRET') ?? 'nextticket-default-secret';
  }

  // ── Issue a new ticket ────────────────────────────────────

  async create(dto: CreateTicketDto, currentHolderId: string) {
    if (dto.originType === 'PURCHASE' && !dto.purchaseDetailId) {
      throw new BadRequestException(
        'purchaseDetailId is required when originType is PURCHASE',
      );
    }

    const folio = this.generateFolio();
    const ticketId = randomBytes(16).toString('hex');
    const qrCode = this.generateQrHash(ticketId);

    const ticket = await this.prisma.ticket.create({
      data: {
        purchaseId: dto.purchaseId,
        purchaseDetailId: dto.purchaseDetailId,
        eventSeatId: dto.eventSeatId,
        eventZoneId: dto.eventZoneId,
        currentHolderId,
        originType: dto.originType,
        folio,
        qrCode,
        issuedAt: new Date(),
        status: 'ISSUED',
      },
    });

    await this.redis.del(LIST_CACHE_KEY);
    await this.redis.del(STATS_CACHE_KEY);
    return ticket;
  }

  // ── List all tickets (cached) ─────────────────────────────

  async findAll(pagination: PaginationQueryDto) {
    // Only the default page is cached: it is the single entry that the
    // existing write invalidations already clear.
    const useCache = isCacheablePage(pagination);

    if (useCache) {
      const cached =
        await this.redis.get<PaginatedResponseDto<unknown>>(LIST_CACHE_KEY);
      if (cached) return cached;
    }

    const { skip, take } = toPrismaPagination(pagination);
    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        skip,
        take,
        omit: HIDE_QR_CODE,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.count(),
    ]);

    const response = buildPaginatedResponse(tickets, total, pagination);

    if (useCache) await this.redis.set(LIST_CACHE_KEY, response, 30);
    return response;
  }

  // ── Aggregated stats for the Admin Dashboard ──────────────

  async getStats(): Promise<TicketsStatsResponseDto> {
    const cached =
      await this.redis.get<TicketsStatsResponseDto>(STATS_CACHE_KEY);
    if (cached) return cached;

    const notCanceled = { status: { not: 'CANCELED' as const } };

    const [totalSold, grouped] = await Promise.all([
      this.prisma.ticket.count({ where: notCanceled }),
      this.prisma.ticket.groupBy({
        by: ['eventZoneId'],
        where: notCanceled,
        _count: true,
        orderBy: { eventZoneId: 'asc' },
      }),
    ]);

    const stats: TicketsStatsResponseDto = {
      totalSold,
      byEventZone: grouped.map((group) => ({
        eventZoneId: group.eventZoneId,
        count: group._count,
      })),
    };

    await this.redis.set(STATS_CACHE_KEY, stats, 30);
    return stats;
  }

  // ── Get ticket by ID ─────────────────────────────────────

  /**
   * Uso interno entre servicios: siempre trae el qrCode.
   * NO devolver su resultado directamente en un endpoint.
   */
  async findOneOrFail(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { validations: true },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} does not exist`);
    return ticket;
  }

  async findOne(id: string, requester: AuthenticatedUser) {
    const ticket = await this.findOneOrFail(id);

    if (canSeeQrCode(ticket.currentHolderId, requester)) {
      return ticket;
    }

    const { qrCode: _qrCode, ...withoutQrCode } = ticket;
    return withoutQrCode;
  }

  // ── Look up ticket by QR hash (for validation scan) ──────

  async findByQrHash(hash: string) {
    if (!SHA_256_HASH_REGEX.test(hash)) {
      throw new BadRequestException(
        'hash must be a valid SHA-256 hexadecimal hash',
      );
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCode: hash },
      include: { validations: true },
    });
    if (!ticket) {
      throw new NotFoundException('No ticket found for the provided QR hash');
    }
    return ticket;
  }

  // ── List tickets by holder ────────────────────────────────

  async findByUser(userId: string) {
    return this.prisma.ticket.findMany({
      where: { currentHolderId: userId },
      omit: HIDE_QR_CODE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ── List tickets by event zone ────────────────────────────

  async findByEventZone(eventZoneId: string) {
    return this.prisma.ticket.findMany({
      where: { eventZoneId },
      omit: HIDE_QR_CODE,
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ── Update ticket status ──────────────────────────────────

  async updateStatus(id: string, dto: UpdateTicketStatusDto) {
    await this.findOneOrFail(id);
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.redis.del(LIST_CACHE_KEY);
    await this.redis.del(STATS_CACHE_KEY);
    return ticket;
  }

  // ── Generate QR image buffer from stored hash ─────────────
  // Uses the `qrcode` library to produce a PNG buffer.
  // The hash is stored in the DB; the image is never persisted.

  async generateQrImage(
    id: string,
    requester: AuthenticatedUser,
  ): Promise<Buffer> {
    const ticket = await this.findOneOrFail(id);

    // La imagen ES el QR: solo la ve el dueño del boleto.
    if (!canSeeQrCode(ticket.currentHolderId, requester)) {
      throw new ForbiddenException('Solo el titular puede ver el QR del boleto');
    }

    // Dynamic import to avoid issues when qrcode is not installed
    const QRCode = await import('qrcode');
    return QRCode.toBuffer(ticket.qrCode, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  }

  // ── Internal: generate a deterministic SHA-256 hash ───────
  // The hash is derived from a unique ticket identifier + secret.
  // This makes QR codes reproducible without storing the image.

  generateQrHash(uniqueId: string): string {
    return createHash('sha256')
      .update(`${uniqueId}:${this.qrHashSecret}:${Date.now()}`)
      .digest('hex');
  }

  // ── Internal: generate auto-increment folio ───────────────
  // Format: TK-XXXXXXX (zero-padded 7-digit number based on timestamp)

  private generateFolio(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = randomBytes(2).toString('hex').toUpperCase();
    return `${FOLIO_PREFIX}-${timestamp}${random}`.slice(0, 20);
  }
}
