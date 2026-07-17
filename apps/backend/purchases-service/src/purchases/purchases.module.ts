import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { TemporaryBlocksScheduler } from './temporary-blocks.scheduler';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, TemporaryBlocksScheduler],
})
export class PurchasesModule {}
