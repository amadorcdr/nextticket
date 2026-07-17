import { Module } from '@nestjs/common';
import { EventSeatController } from './event-seat.controller';
import { EventSeatService } from './event-seat.service';

@Module({
  controllers: [EventSeatController],
  providers: [EventSeatService],
  exports: [EventSeatService],
})
export class EventSeatModule {}
