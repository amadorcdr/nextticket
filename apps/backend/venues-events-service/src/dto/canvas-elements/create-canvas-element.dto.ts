import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsInt, IsOptional, IsEnum, IsBoolean, IsNumber, IsArray, Min, MinLength } from 'class-validator';
import { CanvasElementType } from '@prisma/client';

export class CreateCanvasElementDto {
  @ApiProperty({ enum: CanvasElementType })
  @IsEnum(CanvasElementType)
  elementType!: CanvasElementType;

  @ApiProperty({ example: 'Escenario Principal' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @ApiPropertyOptional({ example: '#3a3a3a' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ example: 100 })
  @IsInt()
  coordinateX!: number;

  @ApiProperty({ example: 200 })
  @IsInt()
  coordinateY!: number;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
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
