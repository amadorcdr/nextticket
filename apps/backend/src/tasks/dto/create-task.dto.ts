import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'; // ← NUEVO
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTaskDto {
    @ApiProperty({ example: 'Comprar leche' }) // ← NUEVO
    @IsString()
    @MinLength(1)
    title!: string;

    @ApiPropertyOptional({ example: false, default: false }) // ← NUEVO
    @IsOptional()
    @IsBoolean()
    done?: boolean;
}