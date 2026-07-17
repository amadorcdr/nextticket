import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un evento',
  })
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar eventos',
  })
  @ApiQuery({
    name: 'organizerId',
    required: false,
    description: 'Filtrar por organizador',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: EventStatus,
  })
  findAll(
    @Query(
      'organizerId',
      new ParseUUIDPipe({
        optional: true,
      }),
    )
    organizerId?: string,
    @Query(
      'status',
      new ParseEnumPipe(EventStatus, {
        optional: true,
      }),
    )
    status?: EventStatus,
  ) {
    return this.events.findAll(organizerId, status);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener evento por id',
  })
  @ApiParam({
    name: 'id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.events.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar evento',
  })
  @ApiParam({
    name: 'id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Cambiar estado del evento',
  })
  @ApiParam({
    name: 'id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventStatusDto,
  ) {
    return this.events.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar evento sin configuración comercial',
  })
  @ApiParam({
    name: 'id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.events.remove(id);
  }
}