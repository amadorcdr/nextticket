import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateValidationDto } from './dto/create-validation.dto';

const LIST_CACHE_KEY = 'tickets:list';
const VALIDATION_RESULT_ACCEPTED = 1;
const VALIDATION_RESULT_REJECTED = 0;

@Injectable()
export class TicketValidationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async validate(dto: CreateValidationDto, validatorId: string) {
    const now = new Date();

    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCode: dto.qrHash },
      include: { validations: true },
    });

    if (!ticket) {
      return {
        success: false,
        result: VALIDATION_RESULT_REJECTED,
        rejectionReason: 'QR hash does not match any ticket',
        validatedAt: now,
      };
    }

    if (ticket.status === 'USED') {
      const validation = await this.createRejectedValidation(
        ticket.id,
        validatorId,
        'Ticket has already been used',
        now,
      );

      return { success: false, ticket, validation };
    }

    if (ticket.status !== 'ISSUED') {
      const validation = await this.createRejectedValidation(
        ticket.id,
        validatorId,
        `Ticket status is ${ticket.status}`,
        now,
      );

      return { success: false, ticket, validation };
    }

    const alreadyValidated = ticket.validations.some(
      (validation) => validation.result === VALIDATION_RESULT_ACCEPTED,
    );

    if (alreadyValidated) {
      const validation = await this.createRejectedValidation(
        ticket.id,
        validatorId,
        'Ticket was already validated successfully',
        now,
      );

      return { success: false, ticket, validation };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.updateMany({
        where: {
          id: ticket.id,
          status: 'ISSUED',
        },
        data: {
          status: 'USED',
        },
      });

      if (updated.count === 0) {
        const currentTicket = await tx.ticket.findUnique({
          where: { id: ticket.id },
        });

        const validation = await tx.ticketValidation.create({
          data: {
            ticketId: ticket.id,
            validatorId,
            validatedAt: now,
            result: VALIDATION_RESULT_REJECTED,
            rejectionReason: currentTicket
              ? `Ticket status is ${currentTicket.status}`
              : 'Ticket is no longer available for validation',
          },
        });

        return {
          success: false,
          ticket: currentTicket ?? ticket,
          validation,
        };
      }

      const updatedTicket = await tx.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });

      const validation = await tx.ticketValidation.create({
        data: {
          ticketId: ticket.id,
          validatorId,
          validatedAt: now,
          result: VALIDATION_RESULT_ACCEPTED,
          rejectionReason: null,
        },
      });

      return { success: true, ticket: updatedTicket, validation };
    });

    await this.redis.del(LIST_CACHE_KEY);

    return result;
  }

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

  async findByValidator(validatorId: string) {
    return this.prisma.ticketValidation.findMany({
      where: { validatorId },
      orderBy: { validatedAt: 'desc' },
    });
  }

  private async createRejectedValidation(
    ticketId: string,
    validatorId: string,
    rejectionReason: string,
    validatedAt: Date,
  ) {
    return this.prisma.ticketValidation.create({
      data: {
        ticketId,
        validatorId,
        validatedAt,
        result: VALIDATION_RESULT_REJECTED,
        rejectionReason,
      },
    });
  }
}
