import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateEventSectionDto } from './dto/create-event-section.dto';
import { UpdateEventSectionDto } from './dto/update-event-section.dto';
import { EventSectionsService } from './event-sections.service';

@ApiTags('event-sections')
@Controller('events/:eventId/sections')
export class EventSectionsController {
  constructor(
    private readonly eventSections: EventSectionsService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Asignar secciones a una zona comercial del evento',
  })
  create(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Body() dto: CreateEventSectionDto,
  ) {
    return this.eventSections.create(eventId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar secciones asignadas del evento',
  })
  findAll(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
  ) {
    return this.eventSections.findAllByEvent(eventId);
  }

  @Get(':sectionId')
  @ApiOperation({
    summary: 'Consultar la asignación de una sección en el evento',
  })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  findOne(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('sectionId', new ParseUUIDPipe())
    sectionId: string,
  ) {
    return this.eventSections.findOne(eventId, sectionId);
  }

  @Patch(':sectionId')
  @ApiOperation({
    summary: 'Reasignar una sección a otra zona comercial',
  })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  update(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('sectionId', new ParseUUIDPipe())
    sectionId: string,
    @Body() dto: UpdateEventSectionDto,
  ) {
    return this.eventSections.update(eventId, sectionId, dto);
  }

  @Delete(':sectionId')
  @ApiOperation({
    summary: 'Retirar una sección del evento',
  })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  remove(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('sectionId', new ParseUUIDPipe())
    sectionId: string,
  ) {
    return this.eventSections.remove(eventId, sectionId);
  }
}
