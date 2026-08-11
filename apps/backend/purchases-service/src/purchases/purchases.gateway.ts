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

  private roomName(eventZoneId: string) {
    return `event-zone:${eventZoneId}`;
  }
}
