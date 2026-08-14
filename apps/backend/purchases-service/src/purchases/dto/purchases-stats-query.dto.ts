import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

/**
 * Filtros de GET /purchases/stats.
 *
 * `from`/`to` acotan la recaudación a un periodo. Los usa la skill de Alexa
 * para responder "cuánto se recaudó en mayo", y sirven igual para cualquier
 * reporte mensual del dashboard.
 */
export class PurchasesStatsQueryDto {
  @ApiPropertyOptional({
    description:
      'Si se indica, agrega las métricas solo de ese evento. Obligatorio para ORGANIZER.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({
    description: 'Inicio del periodo, ISO 8601. Se compara contra Purchase.createdAt.',
    example: '2026-05-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Fin del periodo, ISO 8601.',
    example: '2026-05-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
