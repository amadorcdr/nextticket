import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TicketsModule } from './tickets/tickets.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga .env
    PrismaModule,
    RedisModule,
    TicketsModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
