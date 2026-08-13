import { ApiProperty } from '@nestjs/swagger';

/** Respuesta agregada para las tarjetas de ingresos/compras del Dashboard de Administrador. */
export class PurchasesStatsResponseDto {
  @ApiProperty({
    description: 'Suma de Purchase.total sobre compras CONFIRMED',
    example: 3420500,
  })
  totalRevenue!: number;

  @ApiProperty({
    description: 'Compras creadas en las últimas 24 horas',
    example: 37,
  })
  recentPurchasesCount!: number;
}
