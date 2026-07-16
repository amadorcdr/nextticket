import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateVenueDto {
  @ApiPropertyOptional({ example: 'Foro Sol' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
