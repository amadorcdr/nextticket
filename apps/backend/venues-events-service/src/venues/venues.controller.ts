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
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { VenuesService } from './venues.service';
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
  constructor(private readonly venues: VenuesService) { }

  // ═══════════════════════════════════════════════════════════
  //  VENUES
  // ═══════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({ summary: 'Crear recinto' })
  createVenue(@Body() dto: CreateVenueDto) {
    return this.venues.createVenue(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los recintos (con árbol completo)' })
  findAllVenues() {
    return this.venues.findAllVenues();
  }

  @Get(':venueId')
  @ApiOperation({ summary: 'Obtener recinto por id (con árbol completo)' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  findOneVenue(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.venues.findOneVenue(venueId);
  }

  @Patch(':venueId')
  @ApiOperation({ summary: 'Actualizar recinto' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  updateVenue(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venues.updateVenue(venueId, dto);
  }

  @Delete(':venueId')
  @ApiOperation({ summary: 'Eliminar recinto (cascada: floors, sections, seats, canvas elements)' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  removeVenue(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.venues.removeVenue(venueId);
  }

  // ═══════════════════════════════════════════════════════════
  //  FLOORS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors')
  @ApiOperation({ summary: 'Crear piso en un recinto' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  createFloor(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Body() dto: CreateFloorDto,
  ) {
    return this.venues.createFloor(venueId, dto);
  }

  @Get(':venueId/floors')
  @ApiOperation({ summary: 'Listar pisos de un recinto' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  findAllFloors(@Param('venueId', ParseUUIDPipe) venueId: string) {
    return this.venues.findAllFloors(venueId);
  }

  @Get(':venueId/floors/:floorId')
  @ApiOperation({ summary: 'Obtener piso por id' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  findOneFloor(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
  ) {
    return this.venues.findOneFloor(floorId);
  }

  @Patch(':venueId/floors/:floorId')
  @ApiOperation({ summary: 'Actualizar piso' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  updateFloor(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
    @Body() dto: UpdateFloorDto,
  ) {
    return this.venues.updateFloor(floorId, dto);
  }

  @Delete(':venueId/floors/:floorId')
  @ApiOperation({ summary: 'Eliminar piso (cascada: sections, seats, canvas elements)' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  removeFloor(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
  ) {
    return this.venues.removeFloor(floorId);
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTIONS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors/:floorId/sections')
  @ApiOperation({ summary: 'Crear sección en un piso' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  createSection(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.venues.createSection(venueId, floorId, dto);
  }

  @Get(':venueId/floors/:floorId/sections')
  @ApiOperation({ summary: 'Listar secciones de un piso' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  findAllSections(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
  ) {
    return this.venues.findAllSections(venueId, floorId);
  }

  @Get(':venueId/floors/:floorId/sections/:sectionId')
  @ApiOperation({ summary: 'Obtener sección por id' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  findOneSection(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.venues.findOneSection(sectionId);
  }

  @Patch(':venueId/floors/:floorId/sections/:sectionId')
  @ApiOperation({ summary: 'Actualizar sección' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  updateSection(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.venues.updateSection(sectionId, dto);
  }

  @Delete(':venueId/floors/:floorId/sections/:sectionId')
  @ApiOperation({ summary: 'Eliminar sección (cascada: seats)' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  removeSection(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.venues.removeSection(sectionId);
  }

  // ═══════════════════════════════════════════════════════════
  //  SEATS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors/:floorId/sections/:sectionId/seats')
  @ApiOperation({ summary: 'Crear asiento en una sección' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  createSeat(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
    @Body() dto: CreateSeatDto,
  ) {
    return this.venues.createSeat(venueId, floorId, sectionId, dto);
  }

  @Get(':venueId/floors/:floorId/sections/:sectionId/seats')
  @ApiOperation({ summary: 'Listar asientos de una sección' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  findAllSeats(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
    @Param('sectionId', ParseUUIDPipe) sectionId: string,
  ) {
    return this.venues.findAllSeats(venueId, floorId, sectionId);
  }

  @Get(':venueId/floors/:floorId/sections/:sectionId/seats/:seatId')
  @ApiOperation({ summary: 'Obtener asiento por id' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  @ApiParam({ name: 'seatId', description: 'UUID del asiento' })
  findOneSeat(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('sectionId', ParseUUIDPipe) _sectionId: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
  ) {
    return this.venues.findOneSeat(seatId);
  }

  @Patch(':venueId/floors/:floorId/sections/:sectionId/seats/:seatId')
  @ApiOperation({ summary: 'Actualizar asiento' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  @ApiParam({ name: 'seatId', description: 'UUID del asiento' })
  updateSeat(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('sectionId', ParseUUIDPipe) _sectionId: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
    @Body() dto: UpdateSeatDto,
  ) {
    return this.venues.updateSeat(seatId, dto);
  }

  @Delete(':venueId/floors/:floorId/sections/:sectionId/seats/:seatId')
  @ApiOperation({ summary: 'Eliminar asiento' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'sectionId', description: 'UUID de la sección' })
  @ApiParam({ name: 'seatId', description: 'UUID del asiento' })
  removeSeat(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('sectionId', ParseUUIDPipe) _sectionId: string,
    @Param('seatId', ParseUUIDPipe) seatId: string,
  ) {
    return this.venues.removeSeat(seatId);
  }

  // ═══════════════════════════════════════════════════════════
  //  CANVAS ELEMENTS
  // ═══════════════════════════════════════════════════════════

  @Post(':venueId/floors/:floorId/canvas-elements')
  @ApiOperation({ summary: 'Crear elemento de canvas en un piso' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  createCanvasElement(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
    @Body() dto: CreateCanvasElementDto,
  ) {
    return this.venues.createCanvasElement(venueId, floorId, dto);
  }

  @Get(':venueId/floors/:floorId/canvas-elements')
  @ApiOperation({ summary: 'Listar elementos de canvas de un piso' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  findAllCanvasElements(
    @Param('venueId', ParseUUIDPipe) venueId: string,
    @Param('floorId', ParseUUIDPipe) floorId: string,
  ) {
    return this.venues.findAllCanvasElements(venueId, floorId);
  }

  @Get(':venueId/floors/:floorId/canvas-elements/:elementId')
  @ApiOperation({ summary: 'Obtener elemento de canvas por id' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'elementId', description: 'UUID del elemento de canvas' })
  findOneCanvasElement(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('elementId', ParseUUIDPipe) elementId: string,
  ) {
    return this.venues.findOneCanvasElement(elementId);
  }

  @Patch(':venueId/floors/:floorId/canvas-elements/:elementId')
  @ApiOperation({ summary: 'Actualizar elemento de canvas' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'elementId', description: 'UUID del elemento de canvas' })
  updateCanvasElement(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('elementId', ParseUUIDPipe) elementId: string,
    @Body() dto: UpdateCanvasElementDto,
  ) {
    return this.venues.updateCanvasElement(elementId, dto);
  }

  @Delete(':venueId/floors/:floorId/canvas-elements/:elementId')
  @ApiOperation({ summary: 'Eliminar elemento de canvas' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  @ApiParam({ name: 'floorId', description: 'UUID del piso' })
  @ApiParam({ name: 'elementId', description: 'UUID del elemento de canvas' })
  removeCanvasElement(
    @Param('venueId', ParseUUIDPipe) _venueId: string,
    @Param('floorId', ParseUUIDPipe) _floorId: string,
    @Param('elementId', ParseUUIDPipe) elementId: string,
  ) {
    return this.venues.removeCanvasElement(elementId);
  }
}
