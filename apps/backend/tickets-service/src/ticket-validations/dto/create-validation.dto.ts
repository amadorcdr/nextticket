import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength } from 'class-validator';

export class CreateValidationDto {
  @ApiProperty({
    description: 'SHA-256 hash extracted from the scanned QR code',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @MinLength(1)
  qrHash!: string;

  @ApiProperty({
    description: 'ID of the staff member performing the validation',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  validatorId!: string;
}
