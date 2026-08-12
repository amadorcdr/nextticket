import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'SecurePass123!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Activa o desactiva la cuenta (borrado lógico).',
  })
  @IsOptional()
  @IsBoolean()
  status?: boolean;

  /*
   * roleId NO va aquí a proposito: cambiar de rol es escalar privilegios.
   * Se hace en PATCH /users/:id/role, que solo puede llamar un ADMIN.
   */
}
