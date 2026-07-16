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
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@ApiTags('tickets')
@Controller('tickets')
export class TicketsController {
    constructor(private readonly tickets: TicketsService) { }

    @Post()
    @ApiOperation({ summary: 'Crear ticket' })
    create(@Body() dto: CreateTicketDto) {
        return this.tickets.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todos los tickets' })
    findAll() {
        return this.tickets.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener ticket por id' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    findOne(@Param('id') id: string) {
        return this.tickets.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar ticket' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
        return this.tickets.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar ticket' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    remove(@Param('id') id: string) {
        return this.tickets.remove(id);
    }
}
