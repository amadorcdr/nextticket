import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DiscardPasswordResetDto {
  @ApiProperty({ description: 'Token recibido en el correo de recuperación' })
  @IsString()
  token!: string;
}
