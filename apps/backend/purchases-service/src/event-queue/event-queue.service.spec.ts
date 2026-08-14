/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any */
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DelayedError } from 'bullmq';
import { Prisma, QueueEntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PurchasesGateway } from '../purchases/purchases.gateway';
import { EventQueueRegistryService } from './event-queue-registry.service';
import { EventQueueService } from './event-queue.service';

const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const USER_ID = '550e8400-e29b-41d4-a716-446655440001';

describe('EventQueueService', () => {
  let service: EventQueueService;

  const prisma = {
    queueEntry: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const gateway = { emitQueueAdmitted: jest.fn(), emitQueueExpired: jest.fn() };
  const queueAdd = jest.fn();
  const registry = {
    getQueue: jest.fn(() => ({ add: queueAdd })),
    ensureWorker: jest.fn(),
  };

  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventQueueService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      gateway as unknown as PurchasesGateway,
      registry as unknown as EventQueueRegistryService,
    );
    fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'PUBLISHED' }),
    } as Response);
    prisma.queueEntry.count.mockResolvedValue(0);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('joinQueue', () => {
    it('crea una entrada WAITING y encola un job de admisión con jobId = entry.id cuando no hay idempotencyKey', async () => {
      prisma.queueEntry.findFirst.mockResolvedValueOnce(null);
      prisma.queueEntry.create.mockResolvedValueOnce({
        id: 'entry-1',
        eventId: EVENT_ID,
        status: QueueEntryStatus.WAITING,
        admissionExpiresAt: null,
        createdAt: new Date(),
      });

      const result = await service.joinQueue(EVENT_ID, USER_ID, {});

      expect(result).toEqual(
        expect.objectContaining({
          queueEntryId: 'entry-1',
          status: QueueEntryStatus.WAITING,
          position: 1,
        }),
      );
      expect(registry.getQueue).toHaveBeenCalledWith(EVENT_ID);
      expect(registry.ensureWorker).toHaveBeenCalled();
      expect(queueAdd).toHaveBeenCalledWith(
        'admit',
        { queueEntryId: 'entry-1', userId: USER_ID, eventId: EVENT_ID },
        expect.objectContaining({ jobId: 'entry-1' }),
      );
    });

    it('rechaza unirse a un evento que no está PUBLISHED', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'DRAFT' }),
      } as Response);

      await expect(service.joinQueue(EVENT_ID, USER_ID, {})).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.queueEntry.create).not.toHaveBeenCalled();
    });

    it('rechaza unirse a un evento inexistente', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) } as Response);

      await expect(service.joinQueue(EVENT_ID, USER_ID, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('idempotencia: reintentar con la misma idempotencyKey devuelve la misma entrada sin crear otra ni encolar otro job', async () => {
      prisma.queueEntry.findFirst.mockResolvedValueOnce({
        id: 'entry-1',
        eventId: EVENT_ID,
        status: QueueEntryStatus.WAITING,
        admissionExpiresAt: null,
        createdAt: new Date(),
      });

      const result = await service.joinQueue(EVENT_ID, USER_ID, {
        idempotencyKey: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      });

      expect(result.queueEntryId).toBe('entry-1');
      expect(prisma.queueEntry.create).not.toHaveBeenCalled();
      expect(queueAdd).not.toHaveBeenCalled();
    });

    it('idempotencia por identidad: un usuario con entrada activa no crea otra aunque no mande idempotencyKey (doble clic)', async () => {
      prisma.queueEntry.findFirst.mockResolvedValueOnce({
        id: 'entry-1',
        eventId: EVENT_ID,
        status: QueueEntryStatus.WAITING,
        admissionExpiresAt: null,
        createdAt: new Date(),
      });

      const result = await service.joinQueue(EVENT_ID, USER_ID, {});

      expect(result.queueEntryId).toBe('entry-1');
      expect(prisma.queueEntry.create).not.toHaveBeenCalled();
    });

    it('recupera la entrada existente si create() choca con el índice único (doble clic simultáneo)', async () => {
      prisma.queueEntry.findFirst
        .mockResolvedValueOnce(null) // no hay entrada activa en el pre-check
        .mockResolvedValueOnce({
          id: 'entry-recovered',
          eventId: EVENT_ID,
          status: QueueEntryStatus.WAITING,
          admissionExpiresAt: null,
          createdAt: new Date(),
        }); // recuperada tras el choque de unicidad

      prisma.queueEntry.create.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.8.0',
        }),
      );

      const result = await service.joinQueue(EVENT_ID, USER_ID, {});

      expect(result.queueEntryId).toBe('entry-recovered');
      expect(queueAdd).not.toHaveBeenCalled();
    });
  });

  describe('getStatus / getMyStatus', () => {
    it('rechaza consultar una entrada de otro usuario', async () => {
      prisma.queueEntry.findUnique.mockResolvedValueOnce({
        id: 'entry-1',
        eventId: EVENT_ID,
        userId: 'otro-usuario',
        status: QueueEntryStatus.WAITING,
        admissionExpiresAt: null,
        createdAt: new Date(),
      });

      await expect(
        service.getStatus(EVENT_ID, 'entry-1', USER_ID),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('getMyStatus lanza NotFound si no hay entrada activa', async () => {
      prisma.queueEntry.findFirst.mockResolvedValueOnce(null);

      await expect(service.getMyStatus(EVENT_ID, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('expira perezosamente una admisión vencida al consultarla', async () => {
      const pastExpiry = new Date(Date.now() - 1000);
      prisma.queueEntry.findFirst.mockResolvedValueOnce({
        id: 'entry-1',
        eventId: EVENT_ID,
        userId: USER_ID,
        status: QueueEntryStatus.ADMITTED,
        admissionExpiresAt: pastExpiry,
        createdAt: new Date(),
      });

      const result = await service.getMyStatus(EVENT_ID, USER_ID);

      expect(result.status).toBe(QueueEntryStatus.EXPIRED);
      expect(prisma.queueEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: QueueEntryStatus.EXPIRED } }),
      );
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe('processAdmission (worker de admisión)', () => {
    const buildJob = (data: any) => ({ data, moveToDelayed: jest.fn() });

    it('admite cuando hay cupo: guarda TTL en Redis y marca ADMITTED', async () => {
      prisma.queueEntry.findUnique.mockResolvedValueOnce({
        id: 'entry-1',
        status: QueueEntryStatus.WAITING,
      });
      prisma.queueEntry.count.mockResolvedValueOnce(0); // nadie más admitido

      const job = buildJob({ queueEntryId: 'entry-1', userId: USER_ID, eventId: EVENT_ID });
      const result = await (service as any).processAdmission(job, 'token-1');

      expect(result).toEqual({ admitted: true });
      expect(redis.set).toHaveBeenCalledWith(
        `admission:event:${EVENT_ID}:user:${USER_ID}`,
        expect.any(Object),
        expect.any(Number),
      );
      expect(prisma.queueEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: QueueEntryStatus.ADMITTED }),
        }),
      );
      expect(gateway.emitQueueAdmitted).toHaveBeenCalled();
    });

    it('sin cupo: reprograma el job con delay (backpressure) y no admite', async () => {
      prisma.queueEntry.findUnique.mockResolvedValueOnce({
        id: 'entry-1',
        status: QueueEntryStatus.WAITING,
      });
      prisma.queueEntry.count.mockResolvedValueOnce(999); // cupo lleno

      const job = buildJob({ queueEntryId: 'entry-1', userId: USER_ID, eventId: EVENT_ID });

      await expect((service as any).processAdmission(job, 'token-1')).rejects.toBeInstanceOf(
        DelayedError,
      );
      expect(job.moveToDelayed).toHaveBeenCalledWith(expect.any(Number), 'token-1');
      expect(redis.set).not.toHaveBeenCalled();
      expect(gateway.emitQueueAdmitted).not.toHaveBeenCalled();
    });

    it('no hace nada si la entrada ya no está WAITING (cancelada mientras esperaba)', async () => {
      prisma.queueEntry.findUnique.mockResolvedValueOnce({
        id: 'entry-1',
        status: QueueEntryStatus.CANCELED,
      });

      const job = buildJob({ queueEntryId: 'entry-1', userId: USER_ID, eventId: EVENT_ID });
      const result = await (service as any).processAdmission(job, 'token-1');

      expect(result).toEqual({ admitted: false, reason: 'not-waiting' });
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('expireElapsedAdmissions', () => {
    it('marca EXPIRED las admisiones vencidas, borra su key de Redis y emite el evento', async () => {
      prisma.queueEntry.findMany.mockResolvedValueOnce([
        { id: 'entry-1', eventId: EVENT_ID, userId: USER_ID },
      ]);

      const result = await service.expireElapsedAdmissions();

      expect(result).toEqual({ count: 1 });
      expect(prisma.queueEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: QueueEntryStatus.EXPIRED } }),
      );
      expect(redis.del).toHaveBeenCalledWith(`admission:event:${EVENT_ID}:user:${USER_ID}`);
      expect(gateway.emitQueueExpired).toHaveBeenCalledWith(
        expect.objectContaining({ queueEntryId: 'entry-1' }),
      );
    });

    it('no hace nada si no hay admisiones vencidas', async () => {
      prisma.queueEntry.findMany.mockResolvedValueOnce([]);

      const result = await service.expireElapsedAdmissions();

      expect(result).toEqual({ count: 0 });
      expect(prisma.queueEntry.updateMany).not.toHaveBeenCalled();
    });
  });
});
