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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AUTH_ROLES } from '../auth/auth.constants';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PurchasesService } from './purchases.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { CreateTemporaryBlockDto } from './dto/create-temporary-block.dto';
import { PurchasesStatsResponseDto } from './dto/purchases-stats-response.dto';
import { PurchasesStatsQueryDto } from './dto/purchases-stats-query.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@ApiTags('purchases')
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post('temporary-blocks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Crear bloqueo temporal de uno o varios asientos (atómico) o de admisión general por cantidad. Requiere una admisión ACTIVA vigente en la fila virtual del evento (POST /purchases/queue/:eventId).',
  })
  createTemporaryBlock(
    @Body() dto: CreateTemporaryBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.createTemporaryBlock(dto, user.sub);
  }

  @Get('temporary-blocks/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Listar mis bloqueos temporales activos' })
  findMyActiveBlocks(@CurrentUser() user: AuthenticatedUser) {
    return this.purchases.findActiveBlocksByUser(user.sub);
  }

  @Post('temporary-blocks/expire')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ADMIN)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Marcar bloqueos vencidos como expirados (solo ADMIN)',
  })
  expireElapsedBlocks() {
    return this.purchases.expireElapsedBlocks();
  }

  @Delete('temporary-blocks/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Liberar manualmente un bloqueo temporal' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440020' })
  releaseTemporaryBlock(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.releaseTemporaryBlock(id, user.sub);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Crear compra simulada y registrar pago' })
  create(
    @Body() dto: CreatePurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.create(dto, user.sub);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Listar compras propias, paginadas (el ADMIN ve todas; el ORGANIZER que manda eventId de su propio evento ve todas las de ese evento)',
  })
  @ApiQuery({
    name: 'eventId',
    required: false,
    description: 'Filtrar por evento',
  })
  findAll(
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Query('eventId', new ParseUUIDPipe({ optional: true })) eventId?: string,
  ) {
    return this.purchases.findAll(pagination, user, eventId);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AUTH_ROLES.ADMIN, AUTH_ROLES.ORGANIZER)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Métricas agregadas de compras para el Dashboard de Administrador, o de un evento propio para un ORGANIZER',
  })
  @ApiQuery({
    name: 'eventId',
    required: false,
    description: 'Si se indica, agrega las métricas solo de ese evento. Obligatorio para ORGANIZER.',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'Inicio del periodo (ISO 8601). Acota la recaudación a un rango de fechas.',
    example: '2026-05-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'Fin del periodo (ISO 8601).',
    example: '2026-05-31T23:59:59.000Z',
  })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PurchasesStatsQueryDto,
  ): Promise<PurchasesStatsResponseDto> {
    return this.purchases.getStats(user, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Obtener compra por id (propia o ADMIN)' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Actualizar estado de compra' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePurchaseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.update(id, dto, user.sub);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Cancelar compra' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.purchases.remove(id, user.sub);
  }
}
