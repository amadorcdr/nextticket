import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Body del endpoint interno POST /tickets/internal/issue-for-purchase.
 * Solo lo llama purchases-service, inmediatamente después de confirmar una
 * compra — por eso `currentHolderId` viene explícito en el body (no hay JWT
 * de usuario en una llamada servicio-a-servicio) en vez de tomarse del token
 * como en POST /tickets.
 */
export class IssueTicketForPurchaseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID('4')
  purchaseId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID('4')
  purchaseDetailId!: string;

  @ApiProperty({
    description: 'Comprador real (Purchase.userId) — el titular del ticket.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  currentHolderId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440004' })
  @IsUUID('4')
  eventZoneId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440003' })
  @IsOptional()
  @IsUUID('4')
  eventSeatId?: string;
}
