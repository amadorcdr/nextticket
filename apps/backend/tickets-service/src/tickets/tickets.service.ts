import { createHash, randomBytes } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  buildPaginatedResponse,
  isCacheablePage,
  toPrismaPagination,
} from '../common/pagination.helper';

const LIST_CACHE_KEY = 'tickets:list';
const FOLIO_PREFIX = 'TK';
const SHA_256_HASH_REGEX = /^[a-fA-F0-9]{64}$/;

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

  async create(dto: CreateTicketDto) {
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
        currentHolderId: dto.currentHolderId,
        originType: dto.originType,
        folio,
        qrCode,
        issuedAt: new Date(),
        status: 'ISSUED',
      },
    });

    await this.redis.del(LIST_CACHE_KEY);
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ticket.count(),
    ]);

    const response = buildPaginatedResponse(tickets, total, pagination);

    if (useCache) await this.redis.set(LIST_CACHE_KEY, response, 30);
    return response;
  }

  // ── Get ticket by ID ─────────────────────────────────────

  async findOne(id: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { validations: true },
    });
    if (!ticket) throw new NotFoundException(`Ticket ${id} does not exist`);
    return ticket;
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
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ── List tickets by event zone ────────────────────────────

  async findByEventZone(eventZoneId: string) {
    return this.prisma.ticket.findMany({
      where: { eventZoneId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  // ── Update ticket status ──────────────────────────────────

  async updateStatus(id: string, dto: UpdateTicketStatusDto) {
    await this.findOne(id);
    const ticket = await this.prisma.ticket.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.redis.del(LIST_CACHE_KEY);
    return ticket;
  }

  // ── Generate QR image buffer from stored hash ─────────────
  // Uses the `qrcode` library to produce a PNG buffer.
  // The hash is stored in the DB; the image is never persisted.

  async generateQrImage(id: string): Promise<Buffer> {
    const ticket = await this.findOne(id);

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
