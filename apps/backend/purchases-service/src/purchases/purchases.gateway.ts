import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface BlockEventPayload {
  blockId: string;
  eventZoneId: string;
  eventSeatId: string | null;
}

interface QueueAdmittedPayload {
  queueEntryId: string;
  eventId: string;
  userId: string;
  admissionExpiresAt: Date;
}

interface QueueExpiredPayload {
  queueEntryId: string;
  eventId: string;
  userId: string;
}

// Clients join a room per event zone so they only receive lock updates for
// the zone/seat map they're currently viewing, not a global broadcast of
// every temporary block in the system.
@WebSocketGateway({
  namespace: 'purchases',
  // Namespaced under /purchases so it rides the same api-gateway proxy rule
  // as the REST endpoints, instead of the socket.io default "/socket.io" path.
  path: '/purchases/socket.io',
  cors: {
    origin: [process.env.GATEWAY_URL ?? 'http://localhost:3001'],
  },
})
export class PurchasesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PurchasesGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinEventZone')
  joinEventZone(client: Socket, eventZoneId: string) {
    void client.join(this.roomName(eventZoneId));
  }

  @SubscribeMessage('leaveEventZone')
  leaveEventZone(client: Socket, eventZoneId: string) {
    void client.leave(this.roomName(eventZoneId));
  }

  @SubscribeMessage('joinEventQueue')
  joinEventQueue(client: Socket, eventId: string) {
    void client.join(this.queueRoomName(eventId));
  }

  @SubscribeMessage('leaveEventQueue')
  leaveEventQueue(client: Socket, eventId: string) {
    void client.leave(this.queueRoomName(eventId));
  }

  emitBlockLocked(payload: BlockEventPayload) {
    this.server.to(this.roomName(payload.eventZoneId)).emit('block.locked', payload);
  }

  emitBlockReleased(payload: BlockEventPayload) {
    this.server.to(this.roomName(payload.eventZoneId)).emit('block.released', payload);
  }

  emitBlockExpired(payload: BlockEventPayload) {
    this.server.to(this.roomName(payload.eventZoneId)).emit('block.expired', payload);
  }

  emitBlockConverted(payload: BlockEventPayload) {
    this.server.to(this.roomName(payload.eventZoneId)).emit('block.converted', payload);
  }

  emitQueueAdmitted(payload: QueueAdmittedPayload) {
    this.server.to(this.queueRoomName(payload.eventId)).emit('queue.admitted', payload);
  }

  emitQueueExpired(payload: QueueExpiredPayload) {
    this.server.to(this.queueRoomName(payload.eventId)).emit('queue.expired', payload);
  }

  private roomName(eventZoneId: string) {
    return `event-zone:${eventZoneId}`;
  }

  private queueRoomName(eventId: string) {
    return `event-queue:${eventId}`;
  }
}
