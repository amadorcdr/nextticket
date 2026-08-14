import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventCategoryStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateEventCategoryDto {
  @ApiPropertyOptional({
    example: 'Conciertos y festivales',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'conciertos-festivales',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug solo puede contener letras minúsculas, números y guiones',
  })
  slug?: string;

  @ApiPropertyOptional({
    example: 'Eventos musicales, conciertos y festivales.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    enum: EventCategoryStatus,
  })
  @IsOptional()
  @IsEnum(EventCategoryStatus)
  status?: EventCategoryStatus;
}