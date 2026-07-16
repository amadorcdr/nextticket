import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTicketDto {
  @ApiPropertyOptional({ example: 'FOLIO-67890' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  folio?: string;
}
