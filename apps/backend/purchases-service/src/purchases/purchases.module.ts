import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesGateway } from './purchases.gateway';
import { PurchasesService } from './purchases.service';
import { TemporaryBlocksScheduler } from './temporary-blocks.scheduler';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, PurchasesGateway, TemporaryBlocksScheduler],
})
export class PurchasesModule {}
