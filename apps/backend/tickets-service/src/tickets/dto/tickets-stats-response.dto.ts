import { ApiProperty } from '@nestjs/swagger';

export class TicketZoneCountDto {
  @ApiProperty({
    description: 'Identificador de la zona del evento (EventZone)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  eventZoneId!: string;

  @ApiProperty({ description: 'Boletos vendidos en esa zona', example: 320 })
  count!: number;
}

/** Respuesta agregada para el Dashboard de Administrador. */
export class TicketsStatsResponseDto {
  @ApiProperty({
    description: 'Total de boletos vendidos (no cancelados)',
    example: 18560,
  })
  totalSold!: number;

  @ApiProperty({
    description: 'Boletos vendidos agrupados por zona de evento',
    type: [TicketZoneCountDto],
  })
  byEventZone!: TicketZoneCountDto[];
}
