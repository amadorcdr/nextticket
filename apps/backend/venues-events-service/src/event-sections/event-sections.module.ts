import { Module } from '@nestjs/common';
import { EventSectionsController } from './event-sections.controller';
import { EventSectionsService } from './event-sections.service';

@Module({
  controllers: [EventSectionsController],
  providers: [EventSectionsService],
  exports: [EventSectionsService],
})
export class EventSectionsModule {}
