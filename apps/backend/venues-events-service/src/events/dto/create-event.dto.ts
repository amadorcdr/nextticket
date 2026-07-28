import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
  ArrayUnique,
  IsArray,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({
    example: '889e819f-b0c1-44e0-a502-3695c25b1215',
    description: 'Identificador del recinto',
  })
  @IsUUID('4')
  venueId!: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador externo del organizador en auth-service',
  })
  @IsUUID('4')
  organizerId!: string;

  @ApiPropertyOptional({
    type: [String],
    example: [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiProperty({
    example: 'Rock Revolution Tour',
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    example: '2026-07-20T20:00:00.000Z',
  })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({
    example: '2026-07-20T23:30:00.000Z',
  })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({
    example: 'https://example.com/events/rock-revolution.jpg',
    maxLength: 500,
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'Concierto de rock en vivo.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
