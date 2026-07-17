import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateEventDto {
  @ApiPropertyOptional({
    example: '889e819f-b0c1-44e0-a502-3695c25b1215',
  })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({
    example: 'Rock Revolution Tour 2026',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    example: '2026-07-20T20:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({
    example: '2026-07-20T23:30:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/events/rock-revolution.jpg',
  })
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    example: 'Descripción actualizada del evento.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}