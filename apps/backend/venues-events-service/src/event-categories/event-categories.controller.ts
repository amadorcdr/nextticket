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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';
import { EventCategoriesService } from './event-categories.service';
import { AUTH_ROLES } from '../auth/auth.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@ApiTags('event-categories')
@Controller('event-categories')
export class EventCategoriesController {
  constructor(
    private readonly eventCategories: EventCategoriesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Crear categoría de evento' })
  create(@Body() dto: CreateEventCategoryDto) {
    return this.eventCategories.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar categorías de eventos (paginado)',
  })
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.eventCategories.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por id' })
  @ApiParam({ name: 'id', description: 'UUID de la categoría' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.eventCategories.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Actualizar categoría' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventCategoryDto,
  ) {
    return this.eventCategories.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ORGANIZER, AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Eliminar categoría' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.eventCategories.remove(id);
  }
}