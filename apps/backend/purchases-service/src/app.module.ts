import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { PurchasesModule } from './purchases/purchases.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // carga .env
    PrismaModule,
    RedisModule,
    PurchasesModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
