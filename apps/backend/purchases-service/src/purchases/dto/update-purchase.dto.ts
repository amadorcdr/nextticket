import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdatePurchaseDto {
  @ApiPropertyOptional({ example: 200.00 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  total?: number;
}
