import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { ActivationModule } from '../activation/activation.module';
import { PasswordResetModule } from '../password-reset/password-reset.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [UsersModule, ActivationModule, PasswordResetModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard, Reflector],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}