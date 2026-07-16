import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { VenuesService } from './venues.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

@ApiTags('venues')
@Controller('venues')
export class VenuesController {
    constructor(private readonly venues: VenuesService) { }

    @Post()
    @ApiOperation({ summary: 'Crear recinto' })
    create(@Body() dto: CreateVenueDto) {
        return this.venues.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los recintos' })
    findAll() {
        return this.venues.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener recinto por id' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    findOne(@Param('id') id: string) {
        return this.venues.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar recinto' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    update(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
        return this.venues.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar recinto' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    remove(@Param('id') id: string) {
        return this.venues.remove(id);
    }
}
