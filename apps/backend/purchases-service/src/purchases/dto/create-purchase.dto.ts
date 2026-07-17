import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export enum SimulatedPaymentMethod {
  CASH = 'CASH',
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  TRANSFER = 'TRANSFER',
  DIGITAL_WALLET = 'DIGITAL_WALLET',
}

export class PurchaseDetailDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  eventZoneId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsOptional()
  @IsUUID()
  eventSeatId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440003' })
  @IsOptional()
  @IsUUID()
  priceTierId?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440004' })
  @IsOptional()
  @IsUUID()
  promoCodeUsageId?: string;

  @ApiProperty({ example: 850 })
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ example: 100, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ example: 120, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;
}

export class SimulatedPaymentDto {
  @ApiProperty({
    enum: SimulatedPaymentMethod,
    example: SimulatedPaymentMethod.CREDIT_CARD,
  })
  @IsEnum(SimulatedPaymentMethod)
  paymentMethod!: SimulatedPaymentMethod;

  @ApiPropertyOptional({ example: 'QA APPROVED' })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  cardholderName?: string;

  @ApiPropertyOptional({
    description: 'Solo se usa para simular la respuesta. No se almacena.',
    example: '4242424242424242',
  })
  @IsOptional()
  @Matches(/^\d{16}$/)
  cardNumber?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  expirationMonth?: number;

  @ApiPropertyOptional({ example: 2030 })
  @IsOptional()
  @IsInt()
  @Min(2026)
  expirationYear?: number;

  @ApiPropertyOptional({
    description: 'Solo se valida para simular pago. No se almacena.',
    example: '123',
  })
  @IsOptional()
  @Matches(/^\d{3,4}$/)
  cvv?: string;
}

export class CreatePurchaseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  @IsUUID()
  eventId!: string;

  @ApiPropertyOptional({
    description: 'Bloqueos temporales activos que se convertirán en compra.',
    example: ['550e8400-e29b-41d4-a716-446655440020'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  temporaryBlockIds?: string[];

  @ApiProperty({ type: [PurchaseDetailDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseDetailDto)
  details!: PurchaseDetailDto[];

  @ApiProperty({ type: SimulatedPaymentDto })
  @ValidateNested()
  @Type(() => SimulatedPaymentDto)
  payment!: SimulatedPaymentDto;
}
