import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ description: 'Total de registros disponibles', example: 137 })
  total!: number;

  @ApiProperty({ description: 'Página actual', example: 1 })
  page!: number;

  @ApiProperty({ description: 'Elementos por página', example: 20 })
  limit!: number;

  @ApiProperty({ description: 'Cantidad total de páginas', example: 7 })
  totalPages!: number;

  @ApiProperty({ description: 'Existe una página siguiente', example: true })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Existe una página anterior', example: false })
  hasPreviousPage!: boolean;
}

/** Envelope returned by every paginated list endpoint. */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Registros de la página actual', isArray: true })
  data!: T[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
