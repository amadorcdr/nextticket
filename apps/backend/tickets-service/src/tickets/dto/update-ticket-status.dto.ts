import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum TicketStatusDto {
  ISSUED = 'ISSUED',
  USED = 'USED',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
}

export class UpdateTicketStatusDto {
  @ApiProperty({
    enum: TicketStatusDto,
    example: TicketStatusDto.CANCELED,
    description: 'New status for the ticket',
  })
  @IsEnum(TicketStatusDto)
  status!: TicketStatusDto;
}
