import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { basename, join } from 'path';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AUTH_ROLES } from '../auth/auth.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { AssignEventCategoriesDto } from './dto/assign-event-categories.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { EventsStatsResponseDto } from './dto/events-stats-response.dto';
import { UpdateEventStatusDto } from './dto/update-event-status.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EVENT_IMAGES_DIR, eventImageMulterOptions } from './event-image.storage';
import { EventsService } from './events.service';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Crear un evento',
  })
  create(@Body() dto: CreateEventDto, @CurrentUser() user: AuthenticatedUser) {
    return this.events.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar eventos paginados',
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
  @ApiQuery({
    name: 'categoryId',
    required: false,
    description: 'Filtrar por UUID de categoria',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filtrar por slug de categoria',
  })
  @ApiQuery({
    name: 'upcoming',
    required: false,
    description: 'Si es true, solo incluye eventos cuya fecha de inicio aún no ocurre',
  })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @Query('organizerId', new ParseUUIDPipe({ optional: true }))
    organizerId?: string,
    @Query('status', new ParseEnumPipe(EventStatus, { optional: true }))
    status?: EventStatus,
    @Query('categoryId', new ParseUUIDPipe({ optional: true }))
    categoryId?: string,
    @Query('category')
    categorySlug?: string,
    @Query('upcoming', new ParseBoolPipe({ optional: true }))
    upcoming?: boolean,
  ) {
    return this.events.findAll(
      pagination,
      organizerId,
      status,
      categoryId,
      categorySlug,
      upcoming,
    );
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Métricas agregadas de eventos para el Dashboard de Administrador',
  })
  getStats(): Promise<EventsStatsResponseDto> {
    return this.events.getStats();
  }

  // Tiene que declararse antes que ':id': si no, Nest intenta resolver
  // "images" como si fuera el :id del evento (mismo motivo por el que
  // 'stats', arriba, también va antes).
  @Get('images/:filename')
  @ApiOperation({
    summary: 'Servir una imagen de evento previamente subida',
  })
  @ApiParam({ name: 'filename', example: '3b1f7f5e-....jpg' })
  getImage(@Param('filename') filename: string, @Res() res: Response) {
    // basename() descarta cualquier "../" que venga en el parámetro: sin
    // esto, alguien podría pedir archivos fuera de la carpeta de imágenes.
    const safeName = basename(filename);
    const filePath = join(EVENT_IMAGES_DIR, safeName);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Imagen no encontrada');
    }

    res.sendFile(filePath);
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Subir la imagen de portada de un evento (JPEG/PNG/WEBP/GIF, máx. 5MB)',
  })
  @ApiParam({
    name: 'id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @UseInterceptors(FileInterceptor('image', eventImageMulterOptions))
  uploadImage(
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Falta el archivo de imagen (campo "image")');
    }
    return this.events.setImage(id, file.filename, user.sub);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener evento por id',
  })
  @ApiParam({
    name: 'id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.events.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.events.update(id, dto, user.sub);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
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
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.events.updateStatus(id, dto.status, user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Eliminar evento sin configuracion comercial',
  })
  @ApiParam({
    name: 'id',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.events.remove(id, user.sub);
  }

  @Post(':eventId/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Asignar categorias a un evento',
  })
  assignCategories(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() dto: AssignEventCategoriesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.events.assignCategories(eventId, dto.categoryIds, user.sub);
  }

  @Delete(':eventId/categories/:categoryId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Eliminar una categoria de un evento',
  })
  removeCategory(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.events.removeCategory(eventId, categoryId, user.sub);
  }
}
