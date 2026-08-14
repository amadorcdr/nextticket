import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Entrada del login por voz. La skill manda lo que dictó el usuario tal cual
 * ("jaguar morado"); el servicio se encarga de normalizarlo antes de buscarlo.
 */
export class AlexaSeedDto {
  @ApiProperty({
    description: 'Palabra clave que el usuario dicta en Alexa',
    example: 'jaguar morado',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(60)
  // Solo letras, números y espacios: es lo único que el reconocimiento de voz
  // transcribe de forma confiable. Nada de símbolos.
  @Matches(/^[a-zA-Z0-9ÁÉÍÓÚÜÑáéíóúüñ ]+$/, {
    message: 'La semilla solo puede tener letras, números y espacios',
  })
  seed!: string;
}
