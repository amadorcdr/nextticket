import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventSeatStatus } from '@prisma/client';
import { UpdateEventSeatDto } from './dto/update-event-seat.dto';
import { EventSeatService } from './event-seat.service';
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
    @Query('eventZoneId') eventZoneId?: string,
    @Query('sectionId') sectionId?: string,
    @Query('status') status?: EventSeatStatus,
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
