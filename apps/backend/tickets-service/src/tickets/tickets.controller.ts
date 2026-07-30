import {
  Body,
  Controller,
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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseQrHashPipe } from '../ticket-validations/pipes/parse-qr-hash.pipe';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Issue a new ticket and generate QR hash' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.tickets.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List tickets (paginated)' })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.tickets.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.tickets.findOne(id);
  }

  @Get(':id/qr')
  @ApiOperation({
    summary: 'Get QR code image (PNG) generated from stored hash',
  })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  async getQrImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const buffer = await this.tickets.generateQrImage(id);
    res.set({ 'Content-Type': 'image/png', 'Content-Length': buffer.length });
    res.end(buffer);
  }

  @Get('hash/:hash')
  @ApiOperation({ summary: 'Look up ticket by QR hash (for validation scan)' })
  @ApiParam({
    name: 'hash',
    example:
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  })
  findByQrHash(@Param('hash', ParseQrHashPipe) hash: string) {
    return this.tickets.findByQrHash(hash);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'List tickets by holder user ID' })
  @ApiParam({
    name: 'userId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByUser(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.tickets.findByUser(userId);
  }

  @Get('event-zone/:eventZoneId')
  @ApiOperation({ summary: 'List tickets by event zone ID' })
  @ApiParam({
    name: 'eventZoneId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByEventZone(
    @Param('eventZoneId', new ParseUUIDPipe()) eventZoneId: string,
  ) {
    return this.tickets.findByEventZone(eventZoneId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update ticket status' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.tickets.updateStatus(id, dto);
  }
}
