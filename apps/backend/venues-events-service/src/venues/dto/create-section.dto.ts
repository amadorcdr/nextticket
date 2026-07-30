import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  Min,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsArray,
  MinLength,
} from 'class-validator';
import { SectionStatus } from '@prisma/client';

export class CreateSectionDto {
  @ApiProperty({ example: 'Zona VIP' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'Zona exclusiva frente al escenario' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 500 })
  @IsInt()
  @Min(0)
  capacity!: number;

  @ApiPropertyOptional({ enum: SectionStatus, default: SectionStatus.ACTIVE })
  @IsOptional()
  @IsEnum(SectionStatus)
  status?: SectionStatus;

  @ApiPropertyOptional({ example: '#0485F7' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: 'ZON-01' })
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  coordinateX?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  coordinateY?: number;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(0)
  width?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsInt()
  @Min(0)
  height?: number;

  @ApiPropertyOptional({ example: 45.5, default: 0 })
  @IsOptional()
  @IsNumber()
  rotationDegrees?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isEllipse?: boolean;

  @ApiPropertyOptional({ type: [Object], example: [{ x: 10, y: 20 }] })
  @IsOptional()
  @IsArray()
  geometryPoints?: any[];
}
