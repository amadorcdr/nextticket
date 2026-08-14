import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Processor, Queue, Worker } from 'bullmq';
import type Redis from 'ioredis';
import { createBullMQConnection } from '../queue/bullmq-connection.provider';

export interface AdmissionJobData {
  queueEntryId: string;
  userId: string;
  eventId: string;
}

// BullMQ prefix: keeps every key this feature creates under "vqueue:*",
// clearly separated from the cache-aside keys ("purchases:*") and the
// seat-hold lock keys ("event-zone:*") that already live in the same Redis
// instance (Módulo 7).
const BULLMQ_PREFIX = 'vqueue';

/**
 * Fila virtual por evento (Módulo 8): una Queue + un Worker de BullMQ por
 * eventId, creados de forma perezosa en el primer "unirme a la fila" y
 * reutilizados después. La alta demanda de un evento no puede saturar la
 * fila de otro porque cada evento tiene su propia cola con su propio
 * nombre (`virtual-queue-{eventId}`) y su propio worker.
 */
@Injectable()
export class EventQueueRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(EventQueueRegistryService.name);
  private readonly connection: Redis = createBullMQConnection();
  private readonly queues = new Map<string, Queue<AdmissionJobData>>();
  private readonly workers = new Map<string, Worker<AdmissionJobData>>();

  getQueue(eventId: string): Queue<AdmissionJobData> {
    let queue = this.queues.get(eventId);
    if (!queue) {
      queue = new Queue<AdmissionJobData>(this.queueName(eventId), {
        connection: this.connection,
        prefix: BULLMQ_PREFIX,
      });
      this.queues.set(eventId, queue);
    }
    return queue;
  }

  ensureWorker(
    eventId: string,
    processor: Processor<AdmissionJobData>,
  ): Worker<AdmissionJobData> {
    let worker = this.workers.get(eventId);
    if (!worker) {
      worker = new Worker<AdmissionJobData>(
        this.queueName(eventId),
        processor,
        {
          connection: this.connection,
          prefix: BULLMQ_PREFIX,
          // concurrency: 1 serializa las decisiones de admisión de ESTE
          // evento (evita que dos jobs cuenten cupo disponible a la vez y
          // admitan de más); no afecta a otros eventos, que tienen su
          // propio worker.
          concurrency: 1,
        },
      );
      worker.on('error', (err) =>
        this.logger.warn(`Worker de fila (event=${eventId}) error: ${err.message}`),
      );
      this.workers.set(eventId, worker);
    }
    return worker;
  }

  private queueName(eventId: string) {
    return `virtual-queue-${eventId}`;
  }

  async onModuleDestroy() {
    await Promise.all([...this.workers.values()].map((worker) => worker.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
    await this.connection.quit();
  }
}
