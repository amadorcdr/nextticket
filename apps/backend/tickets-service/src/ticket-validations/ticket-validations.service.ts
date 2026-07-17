import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateValidationDto } from './dto/create-validation.dto';

@Injectable()
export class TicketValidationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  // ── Validate a ticket by QR hash ─────────────────────────
  // 1. Look up ticket by qrCode (hash)
  // 2. If not found → rejection
  // 3. If status !== ISSUED → rejection with reason
  // 4. If already successfully validated → rejection
  // 5. Otherwise → mark ticket as USED + create validation record

  async validate(dto: CreateValidationDto) {
    const now = new Date();

    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCode: dto.qrHash },
      include: { validations: true },
    });

    // Ticket not found
    if (!ticket) {
      return {
        success: false,
        result: 0,
        rejectionReason: 'QR hash does not match any ticket',
        validatedAt: now,
      };
    }

    // Ticket already used
    if (ticket.status === 'USED') {
      const validation = await this.createValidationRecord(
        ticket.id,
        dto.validatorId,
        0,
        'Ticket has already been used',
        now,
      );
      return { success: false, ticket, validation };
    }

    // Ticket canceled or expired
    if (ticket.status !== 'ISSUED') {
      const validation = await this.createValidationRecord(
        ticket.id,
        dto.validatorId,
        0,
        `Ticket status is ${ticket.status}`,
        now,
      );
      return { success: false, ticket, validation };
    }

    // Already has a successful validation (should not happen, but guard)
    const alreadyValidated = ticket.validations.some((v) => v.result === 1);
    if (alreadyValidated) {
      const validation = await this.createValidationRecord(
        ticket.id,
        dto.validatorId,
        0,
        'Ticket was already validated successfully',
        now,
      );
      return { success: false, ticket, validation };
    }

    // Success: mark ticket as USED and create successful validation
    const [updatedTicket, validation] = await this.prisma.$transaction([
      this.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'USED' },
      }),
      this.prisma.ticketValidation.create({
        data: {
          ticketId: ticket.id,
          validatorId: dto.validatorId,
          validatedAt: now,
          result: 1,
          rejectionReason: null,
        },
      }),
    ]);

    // Invalidate tickets list cache
    await this.redis.del('tickets:list');

    return { success: true, ticket: updatedTicket, validation };
  }

  // ── Get validation history for a ticket ───────────────────

  async findByTicket(ticketId: string) {
    const validations = await this.prisma.ticketValidation.findMany({
      where: { ticketId },
      orderBy: { validatedAt: 'desc' },
    });
    if (validations.length === 0) {
      throw new NotFoundException(
        `No validations found for ticket ${ticketId}`,
      );
    }
    return validations;
  }

  // ── Get validations by validator ──────────────────────────

  async findByValidator(validatorId: string) {
    return this.prisma.ticketValidation.findMany({
      where: { validatorId },
      orderBy: { validatedAt: 'desc' },
    });
  }

  // ── Internal helper ───────────────────────────────────────

  private async createValidationRecord(
    ticketId: string,
    validatorId: string,
    result: number,
    rejectionReason: string | null,
    validatedAt: Date,
  ) {
    return this.prisma.ticketValidation.create({
      data: { ticketId, validatorId, validatedAt, result, rejectionReason },
    });
  }
}
