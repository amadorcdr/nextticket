import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'FOLIO-12345' })
  @IsString()
  @MinLength(1)
  folio!: string;
}
