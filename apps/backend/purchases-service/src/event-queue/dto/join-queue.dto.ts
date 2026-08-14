import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class JoinQueueDto {
  @ApiPropertyOptional({
    description:
      'Clave de idempotencia (UUID). Reintentar la misma solicitud con la misma clave devuelve la entrada ya creada en vez de generar otra (doble clic, reintento HTTP, refresh).',
    example: '550e8400-e29b-41d4-a716-446655440099',
  })
  @IsOptional()
  @IsUUID('4')
  idempotencyKey?: string;
}
