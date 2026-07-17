import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VenueStatus } from '@prisma/client';

export class UpdateVenueDto {
  @ApiPropertyOptional({ example: 'Estadio Olímpico Renovado' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'Av. Insurgentes Sur 1234' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: 'Ciudad de México' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'CDMX' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    example: 'Mexico',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: 52000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalCapacity?: number;

  @ApiPropertyOptional({
    example: 'Recinto actualizado para conciertos y eventos deportivos.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    enum: VenueStatus,
  })
  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;
}