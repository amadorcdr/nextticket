import { ApiProperty } from '@nestjs/swagger';

/** Respuesta agregada para las tarjetas de eventos del Dashboard de Administrador. */
export class EventsStatsResponseDto {
  @ApiProperty({ description: 'Total de eventos registrados', example: 24 })
  totalEvents!: number;

  @ApiProperty({
    description: 'Eventos en estado PUBLISHED o SOLD_OUT',
    example: 9,
  })
  activeEvents!: number;

  @ApiProperty({
    description: 'Eventos activos cuya fecha de inicio aún no ocurre',
    example: 6,
  })
  upcomingEvents!: number;
}
