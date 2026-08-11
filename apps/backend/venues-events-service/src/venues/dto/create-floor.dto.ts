import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsInt, MinLength } from 'class-validator';

export class CreateFloorDto {
  @ApiProperty({ example: 'Planta Baja' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({
    example: 0,
    description: 'Índice de la capa (z-order) para el editor',
  })
  @IsInt()
  levelIndex!: number;
}
