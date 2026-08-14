import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdmissionType,
  EventZoneStatus,
} from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsHexColor,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventZoneDto {
  @ApiProperty({
    example: 'VIP',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  publicName!: string;

  @ApiPropertyOptional({
    enum: AdmissionType,
    default: AdmissionType.RESERVED,
  })
  @IsOptional()
  @IsEnum(AdmissionType)
  admissionType?: AdmissionType;

  @ApiProperty({
    example: 2500,
    minimum: 0,
  })
  @IsNumber({
    maxDecimalPlaces: 2,
  })
  @Min(0)
  eventPrice!: number;

  @ApiPropertyOptional({
    example: '#F59E0B',
  })
  @IsOptional()
  @IsHexColor()
  mapColor?: string;

  @ApiPropertyOptional({
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 255,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(255)
  maxTicketsPerPurchase?: number;

  @ApiPropertyOptional({
    enum: EventZoneStatus,
    default: EventZoneStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EventZoneStatus)
  status?: EventZoneStatus;

  @ApiProperty({
    type: [String],
    example: [
      '550e8400-e29b-41d4-a716-446655440001',
      '550e8400-e29b-41d4-a716-446655440002',
    ],
    description: 'Secciones físicas que formarán la zona comercial',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', {
    each: true,
  })
  sectionIds!: string[];
}