import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateVenueDto {
  @ApiProperty({ example: 'Estadio Azteca' })
  @IsString()
  @MinLength(1)
  name!: string;
}
