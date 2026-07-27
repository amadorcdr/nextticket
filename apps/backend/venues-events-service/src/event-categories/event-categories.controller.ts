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
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';
import { EventCategoriesService } from './event-categories.service';

@ApiTags('event-categories')
@Controller('event-categories')
export class EventCategoriesController {
  constructor(
    private readonly eventCategories: EventCategoriesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear categoría de evento' })
  create(@Body() dto: CreateEventCategoryDto) {
    return this.eventCategories.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar categorías de eventos' })
  findAll() {
    return this.eventCategories.findAll();
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
  @ApiOperation({ summary: 'Actualizar categoría' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEventCategoryDto,
  ) {
    return this.eventCategories.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.eventCategories.remove(id);
  }
}