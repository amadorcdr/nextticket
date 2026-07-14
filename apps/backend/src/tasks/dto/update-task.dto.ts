import { ApiPropertyOptional } from '@nestjs/swagger'; // ← NUEVO
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTaskDto {
    @ApiPropertyOptional({ example: 'Comprar leche deslactosada' }) // ← NUEVO
    @IsOptional()
    @IsString()
    @MinLength(1)
    title?: string;

    @ApiPropertyOptional({ example: true }) // ← NUEVO
    @IsOptional()
    @IsBoolean()
    done?: boolean;
}