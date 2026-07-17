import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TicketsService } from '../tickets/tickets.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TicketTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ticketsService: TicketsService,
  ) {}

  // ── Request a transfer ────────────────────────────────────

  async create(dto: CreateTransferDto) {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException(
        'Sender and receiver must be different users',
      );
    }

    // Verify the ticket exists, is ISSUED, and belongs to the sender
    const ticket = await this.ticketsService.findOne(dto.ticketId);
    if (ticket.status !== 'ISSUED') {
      throw new BadRequestException(
        `Ticket status is ${ticket.status} — only ISSUED tickets can be transferred`,
      );
    }
    if (ticket.currentHolderId !== dto.fromUserId) {
      throw new BadRequestException(
        'Only the current ticket holder can initiate a transfer',
      );
    }

    // Check no pending transfer already exists for this ticket
    const existingPending = await this.prisma.ticketTransfer.findFirst({
      where: { ticketId: dto.ticketId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestException(
        'A pending transfer already exists for this ticket',
      );
    }

    const transfer = await this.prisma.ticketTransfer.create({
      data: {
        ticketId: dto.ticketId,
        fromUserId: dto.fromUserId,
        toUserId: dto.toUserId,
        transferFee: dto.transferFee ?? 0,
        status: 'PENDING',
      },
    });

    return transfer;
  }

  // ── Complete a transfer ───────────────────────────────────
  // Saga within a single Prisma transaction:
  //   1. Cancel the original ticket
  //   2. Issue a new ticket with fresh QR hash for the receiver
  //   3. Update the transfer record with issuedTicketId

  async complete(id: string) {
    const transfer = await this.findOne(id);

    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(
        `Transfer status is ${transfer.status} — only PENDING transfers can be completed`,
      );
    }

    const originalTicket = await this.ticketsService.findOne(transfer.ticketId);
    const now = new Date();
    const newQrHash = this.ticketsService.generateQrHash(
      `transfer-${id}-${Date.now()}`,
    );
    const newFolio = `TX-${Date.now().toString(36).toUpperCase()}`.slice(0, 20);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Cancel the original ticket
      await tx.ticket.update({
        where: { id: originalTicket.id },
        data: { status: 'CANCELED' },
      });

      // 2. Issue new ticket for the receiver
      const newTicket = await tx.ticket.create({
        data: {
          purchaseId: originalTicket.purchaseId,
          purchaseDetailId: originalTicket.purchaseDetailId,
          eventSeatId: originalTicket.eventSeatId,
          eventZoneId: originalTicket.eventZoneId,
          currentHolderId: transfer.toUserId,
          originType: 'TRANSFER',
          folio: newFolio,
          qrCode: newQrHash,
          issuedAt: now,
          status: 'ISSUED',
        },
      });

      // 3. Update transfer record
      const completedTransfer = await tx.ticketTransfer.update({
        where: { id },
        data: {
          issuedTicketId: newTicket.id,
          completedAt: now,
          status: 'COMPLETED',
        },
      });

      return { transfer: completedTransfer, newTicket };
    });

    await this.redis.del('tickets:list');
    return result;
  }

  // ── Reject a transfer ─────────────────────────────────────

  async reject(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(
        `Transfer status is ${transfer.status} — only PENDING transfers can be rejected`,
      );
    }

    return this.prisma.ticketTransfer.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  // ── Cancel a transfer ─────────────────────────────────────

  async cancel(id: string) {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException(
        `Transfer status is ${transfer.status} — only PENDING transfers can be canceled`,
      );
    }

    return this.prisma.ticketTransfer.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }

  // ── Get transfer by ID ────────────────────────────────────

  async findOne(id: string) {
    const transfer = await this.prisma.ticketTransfer.findUnique({
      where: { id },
      include: { ticket: true, issuedTicket: true },
    });
    if (!transfer) {
      throw new NotFoundException(`Transfer ${id} does not exist`);
    }
    return transfer;
  }

  // ── Get transfers involving a user (sent or received) ─────

  async findByUser(userId: string) {
    return this.prisma.ticketTransfer.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: { ticket: true, issuedTicket: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
