/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TicketValidationsService } from './ticket-validations.service';

const VALIDATOR_ID = '550e8400-e29b-41d4-a716-446655440000';
const TICKET_ID = '550e8400-e29b-41d4-a716-446655440001';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440002';
const EVENT_ZONE_ID = '550e8400-e29b-41d4-a716-446655440003';
const OTHER_ZONE_ID = '550e8400-e29b-41d4-a716-446655440004';
const QR_HASH =
  'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const FOLIO = 'TK-A1B2C3D4E5';

describe('TicketValidationsService', () => {
  let service: TicketValidationsService;
  let fetchSpy: jest.SpyInstance;
  const prisma = {
    ticket: {
      findUnique: jest.fn(),
    },
    ticketValidation: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Por defecto la zona del ticket sí pertenece al evento consultado:
    // los tests de estado (USED/CANCELED/etc.) no quieren pelear con esto.
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ zones: [{ id: EVENT_ZONE_ID }] }),
    } as Response);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketValidationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<TicketValidationsService>(TicketValidationsService);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('rejects an unknown QR hash without persisting a validation', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    const result = await service.validate(
      { eventId: EVENT_ID, qrHash: QR_HASH },
      VALIDATOR_ID,
    );

    expect(result).toEqual(
      expect.objectContaining({ success: false, result: 0 }),
    );
    // Sin ticket no hay ticketId, por eso no se puede guardar el intento.
    expect(prisma.ticketValidation.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    // Ticket inexistente: no hace falta ni preguntarle al otro servicio.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects an unknown folio without persisting a validation', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    const result = await service.validate(
      { eventId: EVENT_ID, folio: FOLIO },
      VALIDATOR_ID,
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        result: 0,
        rejectionReason: 'Folio does not match any ticket',
      }),
    );
    expect(prisma.ticket.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { folio: FOLIO } }),
    );
  });

  it('normalizes the folio before looking it up', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await service.validate(
      { eventId: EVENT_ID, folio: '  tk-a1b2c3d4e5  ' },
      VALIDATOR_ID,
    );

    expect(prisma.ticket.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { folio: FOLIO } }),
    );
  });

  it('rejects a ticket that belongs to a different event without leaking its status', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'USED',
      eventZoneId: OTHER_ZONE_ID,
      validations: [],
    });
    prisma.ticketValidation.create.mockResolvedValue({ id: 'validation-id' });

    const result = await service.validate(
      { eventId: EVENT_ID, qrHash: QR_HASH },
      VALIDATOR_ID,
    );

    expect(result.success).toBe(false);
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://localhost:3003/events/${EVENT_ID}`,
    );
    expect(prisma.ticketValidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: TICKET_ID,
          result: 0,
          rejectionReason: 'Ticket does not belong to the selected event',
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an already used ticket and stores the rejection reason', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'USED',
      eventZoneId: EVENT_ZONE_ID,
      validations: [],
    });
    prisma.ticketValidation.create.mockResolvedValue({ id: 'validation-id' });

    const result = await service.validate(
      { eventId: EVENT_ID, qrHash: QR_HASH },
      VALIDATOR_ID,
    );

    expect(result.success).toBe(false);
    expect(prisma.ticketValidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: TICKET_ID,
          validatorId: VALIDATOR_ID,
          result: 0,
          rejectionReason: 'Ticket has already been used',
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a ticket whose status is not ISSUED', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'CANCELED',
      eventZoneId: EVENT_ZONE_ID,
      validations: [],
    });
    prisma.ticketValidation.create.mockResolvedValue({ id: 'validation-id' });

    const result = await service.validate(
      { eventId: EVENT_ID, qrHash: QR_HASH },
      VALIDATOR_ID,
    );

    expect(result.success).toBe(false);
    expect(prisma.ticketValidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: 0,
          rejectionReason: 'Ticket status is CANCELED',
        }),
      }),
    );
  });

  it('rejects a ticket that already has an accepted validation', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'ISSUED',
      eventZoneId: EVENT_ZONE_ID,
      validations: [{ result: 1 }],
    });
    prisma.ticketValidation.create.mockResolvedValue({ id: 'validation-id' });

    const result = await service.validate(
      { eventId: EVENT_ID, qrHash: QR_HASH },
      VALIDATOR_ID,
    );

    expect(result.success).toBe(false);
    expect(prisma.ticketValidation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: 0,
          rejectionReason: 'Ticket was already validated successfully',
        }),
      }),
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts an ISSUED ticket, marks it USED and clears the list cache', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'ISSUED',
      eventZoneId: EVENT_ZONE_ID,
      validations: [],
    });

    const txTicketUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const txValidationCreate = jest
      .fn()
      .mockResolvedValue({ id: 'validation-id', result: 1 });

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ticket: {
          updateMany: txTicketUpdateMany,
          findUnique: jest.fn(),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: TICKET_ID, status: 'USED' }),
        },
        ticketValidation: { create: txValidationCreate },
      }),
    );

    const result = await service.validate(
      { eventId: EVENT_ID, qrHash: QR_HASH },
      VALIDATOR_ID,
    );

    expect(result.success).toBe(true);
    // El cambio a USED solo aplica si el ticket sigue en ISSUED.
    expect(txTicketUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TICKET_ID, status: 'ISSUED' },
        data: { status: 'USED' },
      }),
    );
    expect(txValidationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: 1,
          rejectionReason: null,
        }),
      }),
    );
    expect(redis.del).toHaveBeenCalledWith('tickets:list');
  });

  it('accepts an ISSUED ticket found by folio', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'ISSUED',
      eventZoneId: EVENT_ZONE_ID,
      validations: [],
    });

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ticket: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn(),
          findUniqueOrThrow: jest
            .fn()
            .mockResolvedValue({ id: TICKET_ID, status: 'USED' }),
        },
        ticketValidation: {
          create: jest
            .fn()
            .mockResolvedValue({ id: 'validation-id', result: 1 }),
        },
      }),
    );

    const result = await service.validate(
      { eventId: EVENT_ID, folio: FOLIO },
      VALIDATOR_ID,
    );

    expect(result.success).toBe(true);
    expect(prisma.ticket.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { folio: FOLIO } }),
    );
  });

  it('rejects the scan when another validator won the race inside the transaction', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'ISSUED',
      eventZoneId: EVENT_ZONE_ID,
      validations: [],
    });

    const txValidationCreate = jest
      .fn()
      .mockResolvedValue({ id: 'validation-id', result: 0 });

    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        ticket: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUnique: jest
            .fn()
            .mockResolvedValue({ id: TICKET_ID, status: 'USED' }),
          findUniqueOrThrow: jest.fn(),
        },
        ticketValidation: { create: txValidationCreate },
      }),
    );

    const result = await service.validate(
      { eventId: EVENT_ID, qrHash: QR_HASH },
      VALIDATOR_ID,
    );

    expect(result.success).toBe(false);
    expect(txValidationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: 0,
          rejectionReason: 'Ticket status is USED',
        }),
      }),
    );
  });

  it('throws NotFound when a ticket has no validation history', async () => {
    prisma.ticketValidation.findMany.mockResolvedValue([]);

    await expect(service.findByTicket(TICKET_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the validations performed by a validator, newest first', async () => {
    prisma.ticketValidation.findMany.mockResolvedValue([{ id: 'a' }]);

    await expect(service.findByValidator(VALIDATOR_ID)).resolves.toEqual([
      { id: 'a' },
    ]);
    expect(prisma.ticketValidation.findMany).toHaveBeenCalledWith({
      where: { validatorId: VALIDATOR_ID },
      orderBy: { validatedAt: 'desc' },
    });
  });
});
