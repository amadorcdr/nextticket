import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ example: 150.50 })
  @IsNumber()
  @Min(0)
  total!: number;
}
