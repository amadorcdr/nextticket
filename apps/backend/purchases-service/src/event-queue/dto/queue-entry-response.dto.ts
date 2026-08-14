import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QueueEntryStatus } from '@prisma/client';

export class QueueEntryResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010' })
  queueEntryId: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  eventId: string;

  @ApiProperty({ enum: QueueEntryStatus, example: QueueEntryStatus.WAITING })
  status: QueueEntryStatus;

  @ApiPropertyOptional({
    description: 'Posición estimada en la fila (solo cuando status=WAITING)',
    example: 12,
  })
  position?: number;

  @ApiPropertyOptional({
    description: 'Momento en que expira la admisión (solo cuando status=ADMITTED)',
  })
  admissionExpiresAt?: Date | null;

  @ApiProperty()
  createdAt: Date;
}
