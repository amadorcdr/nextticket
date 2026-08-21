import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DelayedError, Job } from 'bullmq';
import { Prisma, QueueEntryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PurchasesGateway } from '../purchases/purchases.gateway';
import {
  AdmissionJobData,
  EventQueueRegistryService,
} from './event-queue-registry.service';
import { buildAdmissionKey } from './admission-key.util';
import { JoinQueueDto } from './dto/join-queue.dto';
import { QueueEntryResponseDto } from './dto/queue-entry-response.dto';

type QueueEntryRecord = {
  id: string;
  eventId: string;
  userId: string;
  status: QueueEntryStatus;
  admissionExpiresAt: Date | null;
  createdAt: Date;
};

const QUEUE_ADMISSION_TTL_SECONDS = Number(
  process.env.QUEUE_ADMISSION_TTL_SECONDS ?? 120,
);
const MAX_CONCURRENT_ADMITTED_PER_EVENT = Number(
  process.env.MAX_CONCURRENT_ADMITTED_PER_EVENT ?? 50,
);
const QUEUE_ADMISSION_RETRY_DELAY_MS = Number(
  process.env.QUEUE_ADMISSION_RETRY_DELAY_MS ?? 5000,
);

/**
 * Módulo 8 · Fila Virtual. Cada evento tiene su propia BullMQ Queue/Worker
 * (EventQueueRegistryService), así que la alta demanda de un evento nunca
 * bloquea la fila de otro. El Worker (concurrency: 1 por evento) serializa
 * las decisiones de admisión: si no hay cupo, el job se reprograma con
 * delay en vez de admitir de más — es el mecanismo de backpressure.
 */
@Injectable()
export class EventQueueService {
  private readonly logger = new Logger(EventQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly gateway: PurchasesGateway,
    private readonly registry: EventQueueRegistryService,
  ) {}

  async joinQueue(
    eventId: string,
    userId: string,
    dto: JoinQueueDto,
  ): Promise<QueueEntryResponseDto> {
    await this.assertEventJoinable(eventId);

    if (dto.idempotencyKey) {
      const existing = await this.prisma.queueEntry.findFirst({
        where: { eventId, idempotencyKey: dto.idempotencyKey },
      });
      if (existing) return this.toResponse(existing);
    }

    const existingActive = await this.findActiveEntry(eventId, userId);
    if (existingActive) return this.toResponse(existingActive);

    let entry: QueueEntryRecord;
    try {
      entry = await this.prisma.queueEntry.create({
        data: { eventId, userId, idempotencyKey: dto.idempotencyKey },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const recovered = await this.findActiveEntry(eventId, userId);
        if (recovered) return this.toResponse(recovered);
      }
      throw error;
    }

    const queue = this.registry.getQueue(eventId);
    this.registry.ensureWorker(eventId, (job, token) =>
      this.processAdmission(job, token),
    );

    await queue.add(
      'admit',
      { queueEntryId: entry.id, userId, eventId },
      {
        jobId: dto.idempotencyKey ?? entry.id,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 3600 },
      },
    );

    this.logger.log(`queue joined: event=${eventId} entry=${entry.id}`);
    return this.toResponse(entry);
  }

  async getStatus(
    eventId: string,
    entryId: string,
    userId: string,
  ): Promise<QueueEntryResponseDto> {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry || entry.eventId !== eventId) {
      throw new NotFoundException(
        `Entrada de fila ${entryId} no existe para el evento ${eventId}`,
      );
    }
    if (entry.userId !== userId) {
      throw new BadRequestException(
        'La entrada de fila no pertenece al usuario autenticado',
      );
    }
    return this.toResponse(await this.expireIfElapsed(entry));
  }

  async getMyStatus(
    eventId: string,
    userId: string,
  ): Promise<QueueEntryResponseDto> {
    const entry = await this.findActiveEntry(eventId, userId);
    if (!entry) {
      throw new NotFoundException(
        'No tienes una entrada de fila activa para este evento',
      );
    }
    return this.toResponse(await this.expireIfElapsed(entry));
  }

  /**
   * Salida explícita (botón "Cancelar", o el navegador avisando que la
   * pestaña se cierra vía `pagehide`): libera el cupo de inmediato en vez de
   * dejarlo ocupado hasta que venza el TTL de admisión. Idempotente — si ya
   * no hay una entrada activa, no hace nada.
   */
  async leaveQueue(eventId: string, userId: string): Promise<void> {
    const entry = await this.findActiveEntry(eventId, userId);
    if (!entry) return;

    await this.prisma.queueEntry.update({
      where: { id: entry.id },
      data: { status: QueueEntryStatus.CANCELED },
    });
    await this.redis.del(buildAdmissionKey(eventId, userId));
  }

  /** Respaldo del TTL de Redis: mantiene QueueEntry en sync sin que el usuario tenga que hacer nada. */
  async expireElapsedAdmissions() {
    const now = new Date();
    const elapsed = await this.prisma.queueEntry.findMany({
      where: {
        status: QueueEntryStatus.ADMITTED,
        admissionExpiresAt: { lte: now },
      },
    });
    if (elapsed.length === 0) return { count: 0 };

    await this.prisma.queueEntry.updateMany({
      where: { id: { in: elapsed.map((e) => e.id) } },
      data: { status: QueueEntryStatus.EXPIRED },
    });

    await Promise.all(
      elapsed.map((entry) =>
        this.redis.del(buildAdmissionKey(entry.eventId, entry.userId)),
      ),
    );

    for (const entry of elapsed) {
      this.gateway.emitQueueExpired({
        queueEntryId: entry.id,
        eventId: entry.eventId,
        userId: entry.userId,
      });
    }

    this.logger.log(`queue expired: ${elapsed.length} admission(s)`);
    return { count: elapsed.length };
  }

  private async processAdmission(job: Job<AdmissionJobData>, token?: string) {
    const { queueEntryId, userId, eventId } = job.data;

    const entry = await this.prisma.queueEntry.findUnique({
      where: { id: queueEntryId },
    });
    if (!entry || entry.status !== QueueEntryStatus.WAITING) {
      return { admitted: false, reason: 'not-waiting' };
    }

    const activeAdmitted = await this.prisma.queueEntry.count({
      where: {
        eventId,
        status: QueueEntryStatus.ADMITTED,
        admissionExpiresAt: { gt: new Date() },
      },
    });

    if (activeAdmitted >= MAX_CONCURRENT_ADMITTED_PER_EVENT) {
      // Sin cupo todavía: reprograma este job (no cuenta como fallo) y cede
      // el turno del worker al siguiente en espera. Es el backpressure de
      // la fila — se reintenta hasta que se libere un cupo (por expiración
      // o por conversión a compra).
      await job.moveToDelayed(
        Date.now() + QUEUE_ADMISSION_RETRY_DELAY_MS,
        token,
      );
      throw new DelayedError();
    }

    const admittedAt = new Date();
    const admissionExpiresAt = new Date(
      admittedAt.getTime() + QUEUE_ADMISSION_TTL_SECONDS * 1000,
    );
    const admissionKey = buildAdmissionKey(eventId, userId);

    await this.redis.set(
      admissionKey,
      {
        queueEntryId,
        userId,
        eventId,
        admittedAt: admittedAt.toISOString(),
        expiresAt: admissionExpiresAt.toISOString(),
      },
      QUEUE_ADMISSION_TTL_SECONDS,
    );

    try {
      await this.prisma.queueEntry.update({
        where: { id: queueEntryId },
        data: {
          status: QueueEntryStatus.ADMITTED,
          admittedAt,
          admissionExpiresAt,
        },
      });
    } catch (error) {
      await this.redis.del(admissionKey);
      throw error;
    }

    this.gateway.emitQueueAdmitted({
      queueEntryId,
      eventId,
      userId,
      admissionExpiresAt,
    });
    this.logger.log(`queue admitted: event=${eventId} entry=${queueEntryId}`);

    return { admitted: true };
  }

  private async findActiveEntry(eventId: string, userId: string) {
    return this.prisma.queueEntry.findFirst({
      where: {
        eventId,
        userId,
        status: { in: [QueueEntryStatus.WAITING, QueueEntryStatus.ADMITTED] },
      },
    });
  }

  private async expireIfElapsed(
    entry: QueueEntryRecord,
  ): Promise<QueueEntryRecord> {
    if (
      entry.status !== QueueEntryStatus.ADMITTED ||
      !entry.admissionExpiresAt ||
      entry.admissionExpiresAt.getTime() > Date.now()
    ) {
      return entry;
    }

    await this.prisma.queueEntry.update({
      where: { id: entry.id },
      data: { status: QueueEntryStatus.EXPIRED },
    });
    await this.redis.del(buildAdmissionKey(entry.eventId, entry.userId));

    return { ...entry, status: QueueEntryStatus.EXPIRED };
  }

  private async toResponse(
    entry: QueueEntryRecord,
  ): Promise<QueueEntryResponseDto> {
    const position =
      entry.status === QueueEntryStatus.WAITING
        ? (await this.prisma.queueEntry.count({
            where: {
              eventId: entry.eventId,
              status: QueueEntryStatus.WAITING,
              createdAt: { lt: entry.createdAt },
            },
          })) + 1
        : undefined;

    return {
      queueEntryId: entry.id,
      eventId: entry.eventId,
      status: entry.status,
      position,
      admissionExpiresAt: entry.admissionExpiresAt,
      createdAt: entry.createdAt,
    };
  }

  /**
   * Igual que assertOrganizerOwnsEvent en PurchasesService: eventId es
   * opaco (sin FK a venues-events-service), así que se verifica pidiendo
   * directo GET /events/:id, que es público.
   */
  private async assertEventJoinable(eventId: string) {
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
      throw new NotFoundException('No se pudo verificar el evento');
    }

    const event = (await response.json()) as { status?: string };
    if (event.status !== 'PUBLISHED') {
      throw new ConflictException(
        `El evento no está disponible para la fila virtual (status=${event.status})`,
      );
    }
  }
}
