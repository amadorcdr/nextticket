import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsInt, Min, IsEnum } from 'class-validator';
import { VenueStatus } from '@prisma/client';

export class CreateVenueDto {
  @ApiProperty({ example: 'Estadio Azteca' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'Calzada de Tlalpan 3465' })
  @IsString()
  @MinLength(1)
  address!: string;

  @ApiProperty({ example: 'Ciudad de México' })
  @IsString()
  @MinLength(1)
  city!: string;

  @ApiPropertyOptional({ example: 'CDMX' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Mexico', default: 'Mexico' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 87000 })
  @IsInt()
  @Min(0)
  totalCapacity!: number;

  @ApiPropertyOptional({ example: 'Estadio principal de la ciudad.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: VenueStatus, default: VenueStatus.DRAFT })
  @IsOptional()
  @IsEnum(VenueStatus)
  status?: VenueStatus;
}
