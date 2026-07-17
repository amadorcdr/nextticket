import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { VenuesModule } from './venues/venues.module';
import { HealthController } from './health/health.controller';
import { EventsModule } from './events/events.module';
import { EventZonesModule } from './event-zones/event-zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga .env
    PrismaModule,
    RedisModule,
    VenuesModule,
    EventsModule,
    EventZonesModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
