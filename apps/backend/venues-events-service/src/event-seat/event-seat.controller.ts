import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventSeatStatus } from '@prisma/client';
import { UpdateEventSeatDto } from './dto/update-event-seat.dto';
import { EventSeatService } from './event-seat.service';
import { AUTH_ROLES } from '../auth/auth.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('event-seats')
@Controller('events/:eventId/seats')
export class EventSeatController {
  constructor(
    private readonly eventSeat: EventSeatService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'Listar asientos del evento paginados (filtrable por zona, sección o estado)',
  })
  @ApiQuery({ name: 'eventZoneId', required: false })
  @ApiQuery({ name: 'sectionId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: EventSeatStatus })
  findAll(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Query() pagination: PaginationQueryDto,
    @Query('eventZoneId', new ParseUUIDPipe({ optional: true }))
    eventZoneId?: string,
    @Query('sectionId', new ParseUUIDPipe({ optional: true }))
    sectionId?: string,
    @Query('status', new ParseEnumPipe(EventSeatStatus, { optional: true }))
    status?: EventSeatStatus,
  ) {
    return this.eventSeat.findAllByEvent(
      eventId,
      {
        eventZoneId,
        sectionId,
        status,
      },
      pagination,
    );
  }

  @Get('by-event-seat-ids')
  @ApiOperation({
    summary:
      'Consultar varios asientos del evento por el id de su EventSeat (uso interno de otros servicios, p. ej. validar un hold antes de crearlo)',
  })
  @ApiQuery({
    name: 'ids',
    description: 'EventSeat.id separados por coma',
    example: '550e8400-e29b-41d4-a716-446655440002,550e8400-e29b-41d4-a716-446655440003',
  })
  findByEventSeatIds(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Query('ids') ids?: string,
  ) {
    const eventSeatIds = (ids ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    return this.eventSeat.findByEventSeatIds(eventId, eventSeatIds);
  }

  @Get(':seatId')
  @ApiOperation({
    summary: 'Consultar el estado de un asiento en el evento',
  })
  @ApiParam({ name: 'seatId', description: 'UUID del asiento físico' })
  findOne(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('seatId', new ParseUUIDPipe())
    seatId: string,
  ) {
    return this.eventSeat.findOne(eventId, seatId);
  }

  @Patch(':seatId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Actualizar estado o bloqueo temporal de un asiento del evento',
  })
  @ApiParam({ name: 'seatId', description: 'UUID del asiento físico' })
  update(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('seatId', new ParseUUIDPipe())
    seatId: string,
    @Body() dto: UpdateEventSeatDto,
  ) {
    return this.eventSeat.update(eventId, seatId, dto);
  }

  @Delete(':seatId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Retirar un asiento de la venta del evento',
  })
  @ApiParam({ name: 'seatId', description: 'UUID del asiento físico' })
  remove(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('seatId', new ParseUUIDPipe())
    seatId: string,
  ) {
    return this.eventSeat.remove(eventId, seatId);
  }
}
