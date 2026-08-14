import { Module } from '@nestjs/common';
import { ActivationModule } from '../activation/activation.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [ActivationModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
