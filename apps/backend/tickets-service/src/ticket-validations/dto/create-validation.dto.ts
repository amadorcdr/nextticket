import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CreateValidationDto {
  @ApiProperty({
    description: 'SHA-256 hash extracted from the scanned QR code',
    example:
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  })
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'qrHash must be a valid SHA-256 hexadecimal hash',
  })
  qrHash!: string;
}
