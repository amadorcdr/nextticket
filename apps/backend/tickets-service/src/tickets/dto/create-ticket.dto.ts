import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum TicketOriginTypeDto {
  PURCHASE = 'PURCHASE',
  COMPLIMENTARY = 'COMPLIMENTARY',
  STAFF = 'STAFF',
  TRANSFER = 'TRANSFER',
}

export class CreateTicketDto {
  @ApiPropertyOptional({
    description: 'Opaque reference to the purchase in purchases-service',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  purchaseId?: string;

  @ApiPropertyOptional({
    description: 'Opaque reference to the purchase detail in purchases-service',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  purchaseDetailId?: string;

  @ApiPropertyOptional({
    description: 'Opaque reference to the event seat in venues-events-service',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID()
  eventSeatId?: string;

  @ApiProperty({
    description: 'Opaque reference to the event zone in venues-events-service',
    example: '550e8400-e29b-41d4-a716-446655440004',
  })
  @IsUUID()
  eventZoneId!: string;

  @ApiProperty({
    description: 'Opaque reference to the ticket holder in identity-service',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsUUID()
  currentHolderId!: string;

  @ApiProperty({
    enum: TicketOriginTypeDto,
    example: TicketOriginTypeDto.PURCHASE,
    description: 'How the ticket was originated',
  })
  @IsEnum(TicketOriginTypeDto)
  originType!: TicketOriginTypeDto;
}
