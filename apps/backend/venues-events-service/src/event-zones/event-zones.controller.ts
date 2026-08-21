import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AUTH_ROLES } from '../auth/auth.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Crear zona comercial, asignar secciones y generar asientos',
  })
  create(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Body() dto: CreateEventZoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.create(eventId, dto, user);
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Actualizar zona comercial',
  })
  update(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Body() dto: UpdateEventZoneDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.update(
      eventId,
      zoneId,
      dto,
      user,
    );
  }

  @Post(':zoneId/sections')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Agregar secciones a la zona comercial',
  })
  assignSections(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Body() dto: AssignSectionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.assignSections(
      eventId,
      zoneId,
      dto,
      user,
    );
  }

  @Delete(':zoneId/sections/:sectionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.removeSection(
      eventId,
      zoneId,
      sectionId,
      user,
    );
  }

  @Post(':zoneId/price-tiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Crear nivel de precio',
  })
  createPriceTier(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Body() dto: CreatePriceTierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.createPriceTier(
      eventId,
      zoneId,
      dto,
      user,
    );
  }

  @Patch(':zoneId/price-tiers/:tierId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.updatePriceTier(
      eventId,
      zoneId,
      tierId,
      dto,
      user,
    );
  }

  @Delete(':zoneId/price-tiers/:tierId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Eliminar nivel de precio (excepto el base, sortOrder 0)',
  })
  removePriceTier(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @Param('tierId', new ParseUUIDPipe())
    tierId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.removePriceTier(
      eventId,
      zoneId,
      tierId,
      user,
    );
  }

  @Delete(':zoneId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Eliminar zona comercial',
  })
  remove(
    @Param('eventId', new ParseUUIDPipe())
    eventId: string,
    @Param('zoneId', new ParseUUIDPipe())
    zoneId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventZones.remove(
      eventId,
      zoneId,
      user,
    );
  }
}