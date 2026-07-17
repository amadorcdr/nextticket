import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdmissionType,
  EventZoneStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateEventZoneDto {
  @ApiPropertyOptional({
    example: 'VIP Premium',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  publicName?: string;

  @ApiPropertyOptional({
    enum: AdmissionType,
  })
  @IsOptional()
  @IsEnum(AdmissionType)
  admissionType?: AdmissionType;

  @ApiPropertyOptional({
    example: 2750,
  })
  @IsOptional()
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  eventPrice?: number;

  @ApiPropertyOptional({
    example: '#EF4444',
  })
  @IsOptional()
  @IsHexColor()
  mapColor?: string;

  @ApiPropertyOptional({
    example: 8,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(255)
  maxTicketsPerPurchase?: number;

  @ApiPropertyOptional({
    enum: EventZoneStatus,
  })
  @IsOptional()
  @IsEnum(EventZoneStatus)
  status?: EventZoneStatus;
}