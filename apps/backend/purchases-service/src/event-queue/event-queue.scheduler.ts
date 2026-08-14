import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventQueueService } from './event-queue.service';

// Respaldo del TTL de Redis (misma idea que TemporaryBlocksScheduler): la
// admisión ya expira sola vía TTL en Redis, esto solo mantiene en sync el
// registro durable de QueueEntry sin intervención del usuario.
@Injectable()
export class EventQueueScheduler {
  private readonly logger = new Logger(EventQueueScheduler.name);

  constructor(private readonly eventQueue: EventQueueService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async releaseExpiredAdmissions() {
    const { count } = await this.eventQueue.expireElapsedAdmissions();
    if (count > 0) {
      this.logger.log(`Marked ${count} elapsed queue admission(s) as EXPIRED`);
    }
  }
}
