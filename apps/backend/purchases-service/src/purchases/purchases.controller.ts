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
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
    constructor(private readonly purchases: PurchasesService) { }

    @Post()
    @ApiOperation({ summary: 'Crear compra' })
    create(@Body() dto: CreatePurchaseDto) {
        return this.purchases.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Listar todas las compras' })
    findAll() {
        return this.purchases.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Obtener compra por id' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    findOne(@Param('id') id: string) {
        return this.purchases.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Actualizar compra' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    update(@Param('id') id: string, @Body() dto: UpdatePurchaseDto) {
        return this.purchases.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Eliminar compra' })
    @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
    remove(@Param('id') id: string) {
        return this.purchases.remove(id);
    }
}
