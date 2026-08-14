import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriceTierStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePriceTierDto {
  @ApiProperty({
    example: 'Regular',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 2500,
  })
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  initialCapacity?: number;

  @ApiPropertyOptional({
    example: '2026-07-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2026-07-15T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({
    enum: PriceTierStatus,
    default: PriceTierStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PriceTierStatus)
  status?: PriceTierStatus;
}