import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateVenueDto {
  @ApiProperty({ example: 'Estadio Olímpico' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiProperty({ example: 'Av. Insurgentes Sur 1234' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address!: string;

  @ApiProperty({ example: 'Ciudad de México' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional({ example: 'CDMX' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    example: 'Mexico',
    default: 'Mexico',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ example: 50000 })
  @IsInt()
  @Min(1)
  totalCapacity!: number;

  @ApiPropertyOptional({
    example: 'Recinto para conciertos y eventos deportivos.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    enum: VenueStatus,
    default: VenueStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;
}
