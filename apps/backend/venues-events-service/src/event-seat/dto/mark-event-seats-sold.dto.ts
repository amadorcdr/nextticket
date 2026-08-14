import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * Body del endpoint interno POST /events/:eventId/seats/internal/mark-sold.
 * Solo lo llama purchases-service justo después de confirmar una compra.
 */
export class MarkEventSeatsSoldDto {
  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440002'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  eventSeatIds!: string[];
}
