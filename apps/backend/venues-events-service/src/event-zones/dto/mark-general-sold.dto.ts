import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * Body del endpoint interno POST /events/:eventId/zones/:zoneId/internal/mark-general-sold.
 * Solo lo llama purchases-service justo después de confirmar una compra de
 * boletos de admisión general (sin asiento numerado que marcar SOLD).
 */
export class MarkGeneralSoldDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
