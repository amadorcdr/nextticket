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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { VenuesService } from './venues.service';
import { AUTH_ROLES } from '../auth/auth.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { CreateFloorDto } from './dto/create-floor.dto';
import { UpdateFloorDto } from './dto/update-floor.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { CreateSeatDto } from './dto/create-seat.dto';
import { UpdateSeatDto } from './dto/update-seat.dto';
import { CreateCanvasElementDto } from './dto/create-canvas-element.dto';
import { UpdateCanvasElementDto } from './dto/update-canvas-element.dto';

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  // ═══════════════════════════════════════════════════════════
  // VENUES
  // ═══════════════════════════════════════════════════════════

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Crear recinto' })
  createVenue(@Body() dto: CreateVenueDto) {
    return this.venues.createVenue(dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'Listar recintos paginados, con el conteo de pisos y secciones. ' +
      'Para el árbol completo usa GET /venues/:venueId',
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Actualizar recinto' })
  @ApiParam({ name: 'venueId', description: 'UUID del recinto' })
  updateVenue(
    @Param('venueId', new ParseUUIDPipe()) venueId: string,
    @Body() dto: UpdateVenueDto,
  ) {
    return this.venues.updateVenue(venueId, dto);
  }

  @Delete(':venueId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Eliminar elemento de canvas' })
  removeCanvasElement(
    @Param('venueId', new ParseUUIDPipe()) _venueId: string,
    @Param('floorId', new ParseUUIDPipe()) _floorId: string,
    @Param('elementId', new ParseUUIDPipe()) elementId: string,
  ) {
    return this.venues.removeCanvasElement(elementId);
  }
}