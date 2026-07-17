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
import { CreateTemporaryBlockDto } from './dto/create-temporary-block.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post('temporary-blocks')
  @ApiOperation({ summary: 'Crear bloqueo temporal de asiento o zona' })
  createTemporaryBlock(@Body() dto: CreateTemporaryBlockDto) {
    return this.purchases.createTemporaryBlock(dto);
  }

  @Get('temporary-blocks/user/:userId')
  @ApiOperation({ summary: 'Listar bloqueos temporales activos de un usuario' })
  @ApiParam({ name: 'userId', example: '550e8400-e29b-41d4-a716-446655440000' })
  findActiveBlocksByUser(@Param('userId') userId: string) {
    return this.purchases.findActiveBlocksByUser(userId);
  }

  @Post('temporary-blocks/expire')
  @ApiOperation({ summary: 'Marcar bloqueos vencidos como expirados' })
  expireElapsedBlocks() {
    return this.purchases.expireElapsedBlocks();
  }

  @Delete('temporary-blocks/:id')
  @ApiOperation({ summary: 'Liberar manualmente un bloqueo temporal' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440020' })
  releaseTemporaryBlock(@Param('id') id: string) {
    return this.purchases.releaseTemporaryBlock(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear compra simulada y registrar pago' })
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
  @ApiOperation({ summary: 'Actualizar estado de compra' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  update(@Param('id') id: string, @Body() dto: UpdatePurchaseDto) {
    return this.purchases.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancelar compra' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  remove(@Param('id') id: string) {
    return this.purchases.remove(id);
  }
}
