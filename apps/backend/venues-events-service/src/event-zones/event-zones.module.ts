import { Module } from '@nestjs/common';
import { EventZonesController } from './event-zones.controller';
import { EventZonesService } from './event-zones.service';

@Module({
  controllers: [EventZonesController],
  providers: [EventZonesService],
  exports: [EventZonesService],
})
export class EventZonesModule {}