import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, Matches, ValidateIf } from 'class-validator';

export class CreateValidationDto {
  @ApiProperty({
    description:
      'Id del evento que el validador tiene seleccionado. El ticket encontrado debe pertenecer a este evento.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  eventId!: string;

  @ApiPropertyOptional({
    description:
      'SHA-256 hash extracted from the scanned QR code. Required when folio is not provided.',
    example:
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  })
  @ValidateIf((dto: CreateValidationDto) => !dto.folio)
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/, {
    message: 'qrHash must be a valid SHA-256 hexadecimal hash',
  })
  qrHash?: string;

  @ApiPropertyOptional({
    description:
      'Folio printed on the ticket. Required when qrHash is not provided.',
    example: 'TK-A1B2C3D4E5',
  })
  @ValidateIf((dto: CreateValidationDto) => !dto.qrHash)
  @IsString()
  folio?: string;
}
