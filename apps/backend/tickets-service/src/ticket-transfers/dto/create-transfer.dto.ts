import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty({
    description: 'ID of the ticket to transfer',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  ticketId!: string;

  @ApiProperty({
    description: 'ID of the user sending the ticket',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  fromUserId!: string;

  @ApiProperty({
    description: 'ID of the user receiving the ticket',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  toUserId!: string;

  @ApiPropertyOptional({
    description: 'Fee charged for the transfer (default: 0.00)',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  transferFee?: number;
}
