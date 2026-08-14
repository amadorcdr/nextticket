import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { PurchasesModule } from './purchases/purchases.module';
import { EventQueueModule } from './event-queue/event-queue.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga .env
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    PurchasesModule,
    EventQueueModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
