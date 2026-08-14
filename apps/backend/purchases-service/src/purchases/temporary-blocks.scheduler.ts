import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PurchasesService } from './purchases.service';

// Module 7 · Scope 3: automated release by timeout. Redis keys already expire
// on their own via TTL; this job keeps the durable TemporaryBlock records in
// sync by marking elapsed ACTIVE blocks as EXPIRED without user interaction.
@Injectable()
export class TemporaryBlocksScheduler {
  private readonly logger = new Logger(TemporaryBlocksScheduler.name);

  constructor(private readonly purchases: PurchasesService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async releaseExpiredBlocks() {
    const { count } = await this.purchases.expireElapsedBlocks();
    if (count > 0) {
      this.logger.log(`Marked ${count} elapsed temporary block(s) as EXPIRED`);
    }
  }
}
