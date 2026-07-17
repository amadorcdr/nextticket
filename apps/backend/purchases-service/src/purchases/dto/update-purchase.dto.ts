import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum UpdatePurchaseStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
}

export class UpdatePurchaseDto {
  @ApiPropertyOptional({
    enum: UpdatePurchaseStatus,
    example: UpdatePurchaseStatus.CANCELED,
  })
  @IsOptional()
  @IsEnum(UpdatePurchaseStatus)
  status?: UpdatePurchaseStatus;
}
