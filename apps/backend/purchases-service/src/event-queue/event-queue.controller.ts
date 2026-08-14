import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventQueueService } from './event-queue.service';
import { JoinQueueDto } from './dto/join-queue.dto';
import { QueueEntryResponseDto } from './dto/queue-entry-response.dto';

// Montado bajo /purchases (no /events) porque el api-gateway enruta por
// prefijo de path: /events/* va a venues-events-service, /purchases/* va a
// este servicio. La fila virtual vive aquí junto con el hold (Módulo 7),
// con el mismo Redis, guards y gateway WS.
@ApiTags('event-queue')
@Controller('purchases/queue')
export class EventQueueController {
  constructor(private readonly eventQueue: EventQueueService) {}

  @Post(':eventId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Unirse a la fila virtual de un evento (idempotente)',
  })
  @ApiParam({ name: 'eventId', example: '550e8400-e29b-41d4-a716-446655440000' })
  join(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Body() dto: JoinQueueDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QueueEntryResponseDto> {
    return this.eventQueue.joinQueue(eventId, user.sub, dto);
  }

  @Get(':eventId/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Consultar mi entrada de fila activa para un evento',
  })
  @ApiParam({ name: 'eventId', example: '550e8400-e29b-41d4-a716-446655440000' })
  getMyStatus(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QueueEntryResponseDto> {
    return this.eventQueue.getMyStatus(eventId, user.sub);
  }

  @Get(':eventId/:entryId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Consultar el estado de una entrada de fila por id',
  })
  @ApiParam({ name: 'eventId', example: '550e8400-e29b-41d4-a716-446655440000' })
  @ApiParam({ name: 'entryId', example: '550e8400-e29b-41d4-a716-446655440010' })
  getStatus(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QueueEntryResponseDto> {
    return this.eventQueue.getStatus(eventId, entryId, user.sub);
  }
}
