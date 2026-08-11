import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategoryStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEventCategoryDto {
  @ApiProperty({
    example: 'Conciertos',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'conciertos',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug solo puede contener minúsculas, números y guiones',
  })
  slug!: string;

  @ApiPropertyOptional({
    example: 'Eventos musicales y presentaciones en vivo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    enum: EventCategoryStatus,
    default: EventCategoryStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(EventCategoryStatus)
  status?: EventCategoryStatus;
}