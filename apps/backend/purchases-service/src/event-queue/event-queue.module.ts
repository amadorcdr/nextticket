import { Module } from '@nestjs/common';
import { PurchasesModule } from '../purchases/purchases.module';
import { EventQueueController } from './event-queue.controller';
import { EventQueueRegistryService } from './event-queue-registry.service';
import { EventQueueScheduler } from './event-queue.scheduler';
import { EventQueueService } from './event-queue.service';

@Module({
  imports: [PurchasesModule],
  controllers: [EventQueueController],
  providers: [EventQueueService, EventQueueRegistryService, EventQueueScheduler],
})
export class EventQueueModule {}
