import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseZoneRevenueDto {
  @ApiProperty({
    description: 'Identificador de la zona del evento (EventZone)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  eventZoneId!: string;

  @ApiProperty({
    description: 'Ingreso de la zona (finalPrice + taxAmount de sus detalles CONFIRMED)',
    example: 442000,
  })
  revenue!: number;
}

/** Respuesta agregada para las tarjetas de ingresos/compras, global o de un evento. */
export class PurchasesStatsResponseDto {
  @ApiProperty({
    description: 'Suma de Purchase.total sobre compras CONFIRMED (global o del eventId filtrado)',
    example: 3420500,
  })
  totalRevenue!: number;

  @ApiProperty({
    description: 'Compras creadas en las últimas 24 horas (global o del eventId filtrado)',
    example: 37,
  })
  recentPurchasesCount!: number;

  @ApiPropertyOptional({
    description: 'Ingreso desglosado por zona; solo se incluye cuando se filtra por eventId',
    type: [PurchaseZoneRevenueDto],
  })
  byEventZone?: PurchaseZoneRevenueDto[];
}
