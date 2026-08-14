import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateTemporaryBlockDto {
  @ApiProperty({
    description: 'Evento para el que se solicita el bloqueo. Debe existir una admisión ACTIVA (fila virtual) del usuario para este evento.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  eventId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID('4')
  eventZoneId!: string;

  @ApiPropertyOptional({
    description:
      'EventSeat.id de uno o varios asientos a bloquear. Se adquieren todos de forma atómica: si alguno ya está bloqueado, vendido o no existe, no se bloquea ninguno. Si se omite, el bloqueo representa admisión general por cantidad.',
    type: [String],
    example: [
      '550e8400-e29b-41d4-a716-446655440002',
      '550e8400-e29b-41d4-a716-446655440003',
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  eventSeatIds?: string[];

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: 'Solo aplica para admisión general (cuando no se manda eventSeatIds).',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  quantity?: number;
}
