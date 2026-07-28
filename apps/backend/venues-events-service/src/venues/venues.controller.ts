import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { VenuesService } from './venues.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateVenueDto } from '../dto/venues/create-venue.dto';
import { UpdateVenueDto } from '../dto/venues/update-venue.dto';
import { CreateFloorDto } from '../dto/floors/create-floor.dto';
import { UpdateFloorDto } from '../dto/floors/update-floor.dto';
import { CreateSectionDto } from '../dto/sections/create-section.dto';
import { UpdateSectionDto } from '../dto/sections/update-section.dto';
import { CreateSeatDto } from '../dto/seats/create-seat.dto';
import { UpdateSeatDto } from '../dto/seats/update-seat.dto';
import { CreateCanvasElementDto } from '../dto/canvas-elements/create-canvas-element.dto';
import { UpdateCanvasElementDto } from '../dto/canvas-elements/update-canvas-element.dto';

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  // ═══════════════════════════════════════════════════════════
  // VENUES
  // ═══════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({ summary: 'Crear recinto' })
  createVenue(@Body() dto: CreateVenueDto) {
    return this.venues.createVenue(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar recintos paginados (con árbol completo)',
  })
  findAllVenues(@Query() pagination: PaginationQueryDto) {
    return this.venues.findAllVenues(pagination);
  }

  @Get(':venueId')
  @ApiOperation({ summary: 'Obtener recinto por id (con árbol completo)' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  findOneVenue(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    return this.venues.findOneVenue(venueId);
  }

  @Patch(':venueId')
  @ApiOperation({ summary: 'Actualizar recinto' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  updateVenue(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venues.updateVenue(venueId, dto);
  }

  @Delete(':venueId')
  @ApiOperation({
    summary:
      'Eliminar recinto (cascada: floors, sections, seats, canvas elements)',
  })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  removeVenue(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    return this.venues.removeVenue(venueId);
  }

  // ═══════════════════════════════════════════════════════════
  // FLOORS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors')
  @ApiOperation({ summary: 'Crear piso en un recinto' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  createFloor(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: CreateFloorDto,
  ) {
    return this.venues.createFloor(venueId, dto);
  }

  @Get(':venueId/floors')
  @ApiOperation({ summary: 'Listar pisos de un recinto' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  findAllFloors(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
  ) {
    return this.venues.findAllFloors(venueId);
  }

  @Get(':venueId/floors/:floorId')
  @ApiOperation({ summary: 'Obtener piso por id' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  findOneFloor(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
  ) {
    return this.venues.findOneFloor(floorId);
  }

  @Patch(':venueId/floors/:floorId')
  @ApiOperation({ summary: 'Actualizar piso' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  updateFloor(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.venues.updateFloor(floorId, dto);
  }

  @Delete(':venueId/floors/:floorId')
  @ApiOperation({
    summary: 'Eliminar piso (cascada: sections, seats, canvas elements)',
  })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  removeFloor(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
  ) {
    return this.venues.removeFloor(floorId);
  }

  // ═══════════════════════════════════════════════════════════
  // SECTIONS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors/:floorId/sections')
  @ApiOperation({ summary: 'Crear sección en un piso' })
  createSection(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.venues.createSection(venueId, floorId, dto);
  }

  @Get(':venueId/floors/:floorId/sections')
  @ApiOperation({ summary: 'Listar secciones de un piso' })
  findAllSections(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
  ) {
    return this.venues.findAllSections(venueId, floorId);
  }

  @Get(':venueId/floors/:floorId/sections/:sectionId')
  @ApiOperation({ summary: 'Obtener sección por id' })
  findOneSection(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) sectionId: string,
  ) {
    return this.venues.findOneSection(sectionId);
  }

  @Patch(':venueId/floors/:floorId/sections/:sectionId')
  @ApiOperation({ summary: 'Actualizar sección' })
  updateSection(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.venues.updateSection(sectionId, dto);
  }

  @Delete(':venueId/floors/:floorId/sections/:sectionId')
  @ApiOperation({ summary: 'Eliminar sección (cascada: seats)' })
  removeSection(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) sectionId: string,
  ) {
    return this.venues.removeSection(sectionId);
  }

  // ═══════════════════════════════════════════════════════════
  // SEATS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors/:floorId/sections/:sectionId/seats')
  @ApiOperation({ summary: 'Crear asiento en una sección' })
  createSeat(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) sectionId: string,
    @Body() dto: CreateSeatDto,
  ) {
    return this.venues.createSeat(
      venueId,
      floorId,
      sectionId,
      dto,
    );
  }

  @Get(':venueId/floors/:floorId/sections/:sectionId/seats')
  @ApiOperation({ summary: 'Listar asientos de una sección' })
  findAllSeats(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) sectionId: string,
  ) {
    return this.venues.findAllSeats(
      venueId,
      floorId,
      sectionId,
    );
  }

  @Get(':venueId/floors/:floorId/sections/:sectionId/seats/:seatId')
  @ApiOperation({ summary: 'Obtener asiento por id' })
  findOneSeat(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) _sectionId: string,
    @Param('seatId', new ParseUUIDPipe()) seatId: string,
  ) {
    return this.venues.findOneSeat(seatId);
  }

  @Patch(':venueId/floors/:floorId/sections/:sectionId/seats/:seatId')
  @ApiOperation({ summary: 'Actualizar asiento' })
  updateSeat(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) _sectionId: string,
    @Param('seatId', new ParseUUIDPipe()) seatId: string,
    @Body() dto: UpdateSeatDto,
  ) {
    return this.venues.updateSeat(seatId, dto);
  }

  @Delete(':venueId/floors/:floorId/sections/:sectionId/seats/:seatId')
  @ApiOperation({ summary: 'Eliminar asiento' })
  removeSeat(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('sectionId', new ParseUUIDPipe()) _sectionId: string,
    @Param('seatId', new ParseUUIDPipe()) seatId: string,
  ) {
    return this.venues.removeSeat(seatId);
  }

  // ═══════════════════════════════════════════════════════════
  // CANVAS ELEMENTS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors/:floorId/canvas-elements')
  @ApiOperation({ summary: 'Crear elemento de canvas en un piso' })
  createCanvasElement(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
    @Body() dto: CreateCanvasElementDto,
  ) {
    return this.venues.createCanvasElement(
      venueId,
      floorId,
      dto,
    );
  }

  @Get(':venueId/floors/:floorId/canvas-elements')
  @ApiOperation({ summary: 'Listar elementos de canvas de un piso' })
  findAllCanvasElements(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Param('floorId', new ParseUUIDPipe()) floorId: string,
  ) {
    return this.venues.findAllCanvasElements(
      venueId,
      floorId,
    );
  }

  @Get(':venueId/floors/:floorId/canvas-elements/:elementId')
  @ApiOperation({ summary: 'Obtener elemento de canvas por id' })
  findOneCanvasElement(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('elementId', new ParseUUIDPipe()) elementId: string,
  ) {
    return this.venues.findOneCanvasElement(elementId);
  }

  @Patch(':venueId/floors/:floorId/canvas-elements/:elementId')
  @ApiOperation({ summary: 'Actualizar elemento de canvas' })
  updateCanvasElement(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('elementId', new ParseUUIDPipe()) elementId: string,
    @Body() dto: UpdateCanvasElementDto,
  ) {
    return this.venues.updateCanvasElement(
      elementId,
      dto,
    );
  }

  @Delete(':venueId/floors/:floorId/canvas-elements/:elementId')
  @ApiOperation({ summary: 'Eliminar elemento de canvas' })
  removeCanvasElement(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('elementId', new ParseUUIDPipe()) elementId: string,
  ) {
    return this.venues.removeCanvasElement(elementId);
  }
}