import { Module } from '@nestjs/common';
import { TicketValidationsController } from './ticket-validations.controller';
import { TicketValidationsService } from './ticket-validations.service';

@Module({
  controllers: [TicketValidationsController],
  providers: [TicketValidationsService],
})
export class TicketValidationsModule {}
