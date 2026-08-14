import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * El registro de Cliente ya no fija contraseña aquí: crea la cuenta como
 * PENDING y la contraseña se establece al activarla (ver POST /auth/activate),
 * el mismo mecanismo que usa el ADMIN al dar de alta Organizador/Validador.
 */
export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;
}