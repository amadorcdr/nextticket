import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TicketsModule } from './tickets/tickets.module';
import { TicketValidationsModule } from './ticket-validations/ticket-validations.module';
import { TicketTransfersModule } from './ticket-transfers/ticket-transfers.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    TicketsModule,
    TicketValidationsModule,
    TicketTransfersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
