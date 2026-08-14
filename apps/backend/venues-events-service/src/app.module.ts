import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { VenuesModule } from './venues/venues.module';
import { HealthController } from './health/health.controller';
import { EventsModule } from './events/events.module';
import { EventZonesModule } from './event-zones/event-zones.module';
import { EventSectionsModule } from './event-sections/event-sections.module';
import { EventSeatModule } from './event-seat/event-seat.module';
import { EventCategoriesModule } from './event-categories/event-categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga .env
    PrismaModule,
    RedisModule,
    VenuesModule,
    EventsModule,
    EventZonesModule,
    EventSectionsModule,
    EventSeatModule,
    EventCategoriesModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
