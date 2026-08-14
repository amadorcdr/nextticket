/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call */
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { TicketsService } from '../tickets/tickets.service';
import { TicketTransfersService } from './ticket-transfers.service';

const SENDER = '550e8400-e29b-41d4-a716-446655440000';
const RECEIVER = '550e8400-e29b-41d4-a716-446655440001';
const STRANGER = '550e8400-e29b-41d4-a716-446655440002';
const TICKET_ID = '550e8400-e29b-41d4-a716-446655440010';
const TRANSFER_ID = '550e8400-e29b-41d4-a716-446655440020';

describe('TicketTransfersService', () => {
  let service: TicketTransfersService;
  const prisma = {
    ticketTransfer: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const redis = { del: jest.fn() };
  const tickets = { findOneOrFail: jest.fn(), generateQrHash: jest.fn() };

  const pendingTransfer = {
    id: TRANSFER_ID,
    ticketId: TICKET_ID,
    fromUserId: SENDER,
    toUserId: RECEIVER,
    status: 'PENDING',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketTransfersService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
        { provide: TicketsService, useValue: tickets },
      ],
    }).compile();

    service = module.get<TicketTransfersService>(TicketTransfersService);
  });

  describe('create', () => {
    it('rejects a transfer to yourself', async () => {
      await expect(
        service.create({ ticketId: TICKET_ID, toUserId: SENDER }, SENDER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a transfer when the sender is not the current holder', async () => {
      tickets.findOneOrFail.mockResolvedValue({
        id: TICKET_ID,
        status: 'ISSUED',
        currentHolderId: STRANGER,
      });

      await expect(
        service.create({ ticketId: TICKET_ID, toUserId: RECEIVER }, SENDER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a transfer of a ticket that is not ISSUED', async () => {
      tickets.findOneOrFail.mockResolvedValue({
        id: TICKET_ID,
        status: 'USED',
        currentHolderId: SENDER,
      });

      await expect(
        service.create({ ticketId: TICKET_ID, toUserId: RECEIVER }, SENDER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a second pending transfer for the same ticket', async () => {
      tickets.findOneOrFail.mockResolvedValue({
        id: TICKET_ID,
        status: 'ISSUED',
        currentHolderId: SENDER,
      });
      prisma.ticketTransfer.findFirst.mockResolvedValue(pendingTransfer);

      await expect(
        service.create({ ticketId: TICKET_ID, toUserId: RECEIVER }, SENDER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('takes fromUserId from the token, never from the body', async () => {
      tickets.findOneOrFail.mockResolvedValue({
        id: TICKET_ID,
        status: 'ISSUED',
        currentHolderId: SENDER,
      });
      prisma.ticketTransfer.findFirst.mockResolvedValue(null);
      prisma.ticketTransfer.create.mockResolvedValue({ id: TRANSFER_ID });

      await service.create({ ticketId: TICKET_ID, toUserId: RECEIVER }, SENDER);

      expect(prisma.ticketTransfer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromUserId: SENDER,
            toUserId: RECEIVER,
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('ownership rules', () => {
    beforeEach(() => {
      prisma.ticketTransfer.findUnique.mockResolvedValue(pendingTransfer);
    });

    it('only the receiver can complete the transfer', async () => {
      await expect(
        service.complete(TRANSFER_ID, STRANGER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('only the receiver can reject the transfer', async () => {
      await expect(service.reject(TRANSFER_ID, SENDER)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.ticketTransfer.update).not.toHaveBeenCalled();
    });

    it('only the sender can cancel the transfer', async () => {
      await expect(
        service.cancel(TRANSFER_ID, RECEIVER),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.ticketTransfer.update).not.toHaveBeenCalled();
    });

    it('lets the receiver reject a pending transfer', async () => {
      prisma.ticketTransfer.update.mockResolvedValue({ status: 'REJECTED' });

      await expect(service.reject(TRANSFER_ID, RECEIVER)).resolves.toEqual({
        status: 'REJECTED',
      });
    });

    it('lets the sender cancel a pending transfer', async () => {
      prisma.ticketTransfer.update.mockResolvedValue({ status: 'CANCELED' });

      await expect(service.cancel(TRANSFER_ID, SENDER)).resolves.toEqual({
        status: 'CANCELED',
      });
    });

    it('does not act twice on a transfer that is no longer PENDING', async () => {
      prisma.ticketTransfer.findUnique.mockResolvedValue({
        ...pendingTransfer,
        status: 'COMPLETED',
      });

      await expect(
        service.reject(TRANSFER_ID, RECEIVER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
