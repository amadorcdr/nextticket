import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ActivateAccountDto } from './dto/activate-account.dto';
import { ResendActivationDto } from './dto/resend-activation.dto';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Registrar un Cliente (cuenta queda PENDING hasta activarla)',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('activate')
  @ApiOperation({
    summary: 'Activar cuenta y establecer contraseña con el token del correo',
  })
  activate(@Body() dto: ActivateAccountDto) {
    return this.authService.activateAccount(dto);
  }

  @Post('resend-activation')
  @ApiOperation({ summary: 'Reenviar el correo de activación' })
  resendActivation(@Body() dto: ResendActivationDto) {
    return this.authService.resendActivation(dto.email);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('google')
  @ApiOperation({ summary: 'Start Google OAuth flow' })
  async google(@Res() response: Response) {
    response.redirect(await this.authService.getGoogleAuthUrl());
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiQuery({ name: 'code', required: true })
  @ApiQuery({
    name: 'state',
    required: true,
    description: 'Valor de un solo uso que emite GET /auth/google',
  })
  googleCallback(@Query('code') code: string, @Query('state') state: string) {
    return this.authService.handleGoogleCallback(code, state);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated user' })
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.me(user.sub);
  }
}