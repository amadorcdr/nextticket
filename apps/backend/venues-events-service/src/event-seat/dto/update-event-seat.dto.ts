import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventSeatStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
} from 'class-validator';

export class UpdateEventSeatDto {
  @ApiPropertyOptional({ enum: EventSeatStatus, example: EventSeatStatus.DISABLED })
  @IsOptional()
  @IsEnum(EventSeatStatus)
  status?: EventSeatStatus;

  @ApiPropertyOptional({ example: '2026-07-17T18:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  lockedUntil?: string;
}
