/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TicketValidationsService } from './ticket-validations.service';

const VALIDATOR_ID = '550e8400-e29b-41d4-a716-446655440000';
const TICKET_ID = '550e8400-e29b-41d4-a716-446655440001';
const QR_HASH =
  'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';

describe('TicketValidationsService', () => {
  let service: TicketValidationsService;
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketValidationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<TicketValidationsService>(TicketValidationsService);
  });

  it('rejects an unknown QR hash without persisting a validation', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    const result = await service.validate({ qrHash: QR_HASH }, VALIDATOR_ID);

    expect(result).toEqual(
      expect.objectContaining({ success: false, result: 0 }),
    );
    // Sin ticket no hay ticketId, por eso no se puede guardar el intento.
    expect(prisma.ticketValidation.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an already used ticket and stores the rejection reason', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'USED',
      validations: [],
    });
    prisma.ticketValidation.create.mockResolvedValue({ id: 'validation-id' });

    const result = await service.validate({ qrHash: QR_HASH }, VALIDATOR_ID);

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
      validations: [],
    });
    prisma.ticketValidation.create.mockResolvedValue({ id: 'validation-id' });

    const result = await service.validate({ qrHash: QR_HASH }, VALIDATOR_ID);

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
      validations: [{ result: 1 }],
    });
    prisma.ticketValidation.create.mockResolvedValue({ id: 'validation-id' });

    const result = await service.validate({ qrHash: QR_HASH }, VALIDATOR_ID);

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

    const result = await service.validate({ qrHash: QR_HASH }, VALIDATOR_ID);

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

  it('rejects the scan when another validator won the race inside the transaction', async () => {
    prisma.ticket.findUnique.mockResolvedValue({
      id: TICKET_ID,
      status: 'ISSUED',
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

    const result = await service.validate({ qrHash: QR_HASH }, VALIDATOR_ID);

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
