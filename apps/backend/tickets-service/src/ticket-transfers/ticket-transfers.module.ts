import { Module } from '@nestjs/common';
import { TicketsModule } from '../tickets/tickets.module';
import { TicketTransfersController } from './ticket-transfers.controller';
import { TicketTransfersService } from './ticket-transfers.service';

@Module({
  imports: [TicketsModule],
  controllers: [TicketTransfersController],
  providers: [TicketTransfersService],
})
export class TicketTransfersModule {}
