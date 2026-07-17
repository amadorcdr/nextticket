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
import { AssignSectionsDto } from './dto/assign-sections.dto';
import { CreateEventZoneDto } from './dto/create-event-zone.dto';
import { CreatePriceTierDto } from './dto/create-price-tier.dto';
import { UpdateEventZoneDto } from './dto/update-event-zone.dto';
import { UpdatePriceTierDto } from './dto/update-price-tier.dto';
import { EventZonesService } from './event-zones.service';

@ApiTags('event-zones')
@Controller('events/:eventId/zones')
export class EventZonesController {
  constructor(
    private readonly eventZones: EventZonesService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Crear zona comercial, asignar secciones y generar asientos',
  })
  create(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Body() dto: CreateEventZoneDto,
  ) {
    return this.eventZones.create(eventId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar zonas comerciales del evento',
  })
  findAll(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
  ) {
    return this.eventZones.findAllByEvent(eventId);
  }

  @Get(':zoneId')
  @ApiOperation({
    summary: 'Consultar zona comercial',
  })
  findOne(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
  ) {
    return this.eventZones.findOne(eventId, zoneId);
  }

  @Patch(':zoneId')
  @ApiOperation({
    summary: 'Actualizar zona comercial',
  })
  update(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Body() dto: UpdateEventZoneDto,
  ) {
    return this.eventZones.update(
      eventId,
      zoneId,
      dto,
    );
  }

  @Post(':zoneId/sections')
  @ApiOperation({
    summary: 'Agregar secciones a la zona comercial',
  })
  assignSections(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Body() dto: AssignSectionsDto,
  ) {
    return this.eventZones.assignSections(
      eventId,
      zoneId,
      dto,
    );
  }

  @Delete(':zoneId/sections/:sectionId')
  @ApiOperation({
    summary: 'Retirar sección de la zona comercial',
  })
  removeSection(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Param('sectionId', new ParseUUIDPipe())
    sectionId: string,
  ) {
    return this.eventZones.removeSection(
      eventId,
      zoneId,
      sectionId,
    );
  }

  @Post(':zoneId/price-tiers')
  @ApiOperation({
    summary: 'Crear nivel de precio',
  })
  createPriceTier(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Body() dto: CreatePriceTierDto,
  ) {
    return this.eventZones.createPriceTier(
      eventId,
      zoneId,
      dto,
    );
  }

  @Patch(':zoneId/price-tiers/:tierId')
  @ApiOperation({
    summary: 'Actualizar nivel de precio',
  })
  updatePriceTier(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Param('tierId', new ParseUUIDPipe())
    tierId: string,
    @Body() dto: UpdatePriceTierDto,
  ) {
    return this.eventZones.updatePriceTier(
      eventId,
      zoneId,
      tierId,
      dto,
    );
  }

  @Delete(':zoneId')
  @ApiOperation({
    summary: 'Eliminar zona comercial',
  })
  remove(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
  ) {
    return this.eventZones.remove(
      eventId,
      zoneId,
    );
  }
}