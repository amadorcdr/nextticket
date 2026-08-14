import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsEnum,
  MinLength,
} from 'class-validator';
import { SeatType, SeatStatus } from '@prisma/client';

export class CreateSeatDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  @MinLength(1)
  row!: string;

  @ApiProperty({ example: '1' })
  @IsString()
  @MinLength(1)
  number!: string;

  @ApiPropertyOptional({ enum: SeatType, default: SeatType.STANDARD })
  @IsOptional()
  @IsEnum(SeatType)
  type?: SeatType;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  coordinateX?: number;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @IsInt()
  coordinateY?: number;

  @ApiPropertyOptional({ enum: SeatStatus, default: SeatStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(SeatStatus)
  status?: SeatStatus;
}
