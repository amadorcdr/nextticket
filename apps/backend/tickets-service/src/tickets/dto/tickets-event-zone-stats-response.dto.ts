import { ApiProperty } from '@nestjs/swagger';

export class TicketZoneStatusCountsDto {
  @ApiProperty({
    description: 'Identificador de la zona del evento (EventZone)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  eventZoneId!: string;

  @ApiProperty({ description: 'Total de boletos emitidos en la zona', example: 700 })
  total!: number;

  @ApiProperty({ description: 'Boletos vendidos (no cancelados)', example: 650 })
  sold!: number;

  @ApiProperty({ description: 'Boletos validados (status USED)', example: 400 })
  validated!: number;

  @ApiProperty({
    description: 'Boletos vendidos aún sin validar (ISSUED o EXPIRED)',
    example: 250,
  })
  unvalidated!: number;

  @ApiProperty({ description: 'Boletos cancelados', example: 50 })
  canceled!: number;
}

/** Respuesta agregada para el resumen de ventas de un evento. */
export class TicketsEventZoneStatsResponseDto {
  @ApiProperty({ description: 'Total de boletos emitidos para el evento', example: 1200 })
  total!: number;

  @ApiProperty({ description: 'Boletos vendidos (no cancelados)', example: 850 })
  sold!: number;

  @ApiProperty({ description: 'Boletos validados (status USED)', example: 400 })
  validated!: number;

  @ApiProperty({ description: 'Boletos vendidos aún sin validar', example: 450 })
  unvalidated!: number;

  @ApiProperty({ description: 'Boletos cancelados', example: 0 })
  canceled!: number;

  @ApiProperty({
    description: 'Desglose por zona del evento',
    type: [TicketZoneStatusCountsDto],
  })
  byEventZone!: TicketZoneStatusCountsDto[];
}
