import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateValidationDto } from './dto/create-validation.dto';

const LIST_CACHE_KEY = 'tickets:list';
const VALIDATION_RESULT_ACCEPTED = 1;
const VALIDATION_RESULT_REJECTED = 0;
const OTHER_EVENT_REJECTION_REASON =
  'Ticket does not belong to the selected event';

@Injectable()
export class TicketValidationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async validate(dto: CreateValidationDto, validatorId: string) {
    const now = new Date();

    const ticket = await this.prisma.ticket.findUnique({
      where: dto.qrHash
        ? { qrCode: dto.qrHash }
        : { folio: dto.folio!.trim().toUpperCase() },
      include: { validations: true },
    });

    if (!ticket) {
      return {
        success: false,
        result: VALIDATION_RESULT_REJECTED,
        rejectionReason: dto.qrHash
          ? 'QR hash does not match any ticket'
          : 'Folio does not match any ticket',
        validatedAt: now,
      };
    }

    // Un boleto real de otro evento nunca debe pasar, sin importar su
    // estado: esta comprobación va antes que USED/ISSUED a propósito, para
    // no filtrar el estado de un boleto que no pertenece a este evento.
    const belongsToEvent = await this.assertEventZoneBelongsToEvent(
      ticket.eventZoneId,
      dto.eventId,
    );

    if (!belongsToEvent) {
      const validation = await this.createRejectedValidation(
        ticket.id,
        validatorId,
        OTHER_EVENT_REJECTION_REASON,
        now,
      );

      return { success: false, ticket, validation };
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

  /**
   * El Ticket solo guarda eventZoneId (referencia opaca a venues-events-
   * service): para saber si pertenece al evento seleccionado hay que
   * preguntarle a ese servicio por las zonas reales del evento. Mismo
   * patrón que purchases-service usa para verificar precios/zonas.
   */
  private async assertEventZoneBelongsToEvent(
    eventZoneId: string,
    eventId: string,
  ): Promise<boolean> {
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
      throw new ServiceUnavailableException('No se pudo verificar el evento');
    }

    const event = (await response.json()) as {
      zones: Array<{ id: string }>;
    };

    return event.zones.some((zone) => zone.id === eventZoneId);
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
