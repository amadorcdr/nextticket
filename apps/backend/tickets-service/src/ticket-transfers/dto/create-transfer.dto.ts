import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';

const MAX_TRANSFER_FEE = 999999999.99;

export class CreateTransferDto {
  @ApiProperty({
    description: 'ID of the ticket to transfer',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  ticketId!: string;

  @ApiProperty({
    description: 'ID of the user sending the ticket',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4')
  fromUserId!: string;

  @ApiProperty({
    description: 'ID of the user receiving the ticket',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID('4')
  toUserId!: string;

  @ApiPropertyOptional({
    description: 'Fee charged for the transfer (default: 0.00)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_TRANSFER_FEE)
  transferFee?: number;
}
