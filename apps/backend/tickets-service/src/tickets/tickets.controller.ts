import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AUTH_ROLES } from '../auth/auth.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseQrHashPipe } from '../ticket-validations/pipes/parse-qr-hash.pipe';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /** Los boletos de una persona solo los ve ella misma o un ADMIN. */
  private assertSelfOrAdmin(user: AuthenticatedUser, targetUserId: string) {
    if (user.role !== AUTH_ROLES.ADMIN && user.sub !== targetUserId) {
      throw new ForbiddenException('Solo puedes consultar tus propios boletos');
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Issue a new ticket and generate QR hash' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.create(dto, user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List tickets, without QR codes (staff only, paginated)',
  })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.tickets.findAll(pagination);
  }

  @Get('hash/:hash')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.VALIDATOR, AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Look up ticket by QR hash, for the validation scan (staff only)',
  })
  @ApiParam({
    name: 'hash',
    example:
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  })
  findByQrHash(@Param('hash', ParseQrHashPipe) hash: string) {
    return this.tickets.findByQrHash(hash);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List tickets of a holder, without QR codes (self or ADMIN)',
  })
  @ApiParam({
    name: 'userId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByUser(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertSelfOrAdmin(user, userId);
    return this.tickets.findByUser(userId);
  }

  @Get('event-zone/:eventZoneId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List tickets of an event zone, without QR codes (staff only)',
  })
  @ApiParam({
    name: 'eventZoneId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByEventZone(
    @Param('eventZoneId', new ParseUUIDPipe()) eventZoneId: string,
  ) {
    return this.tickets.findByEventZone(eventZoneId);
  }

  @Get(':id/qr')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get QR code image (PNG); only the ticket holder can see it',
  })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  async getQrImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const buffer = await this.tickets.generateQrImage(id, user);
    res.set({ 'Content-Type': 'image/png', 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get ticket by ID; the QR code is only returned to its holder',
  })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tickets.findOne(id, user);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  // El validador también marca boletos (USED) al escanear el QR en la entrada.
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.VALIDATOR, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update ticket status' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.tickets.updateStatus(id, dto);
  }
}
