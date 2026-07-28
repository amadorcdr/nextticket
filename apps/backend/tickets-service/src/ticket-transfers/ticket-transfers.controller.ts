import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TicketTransfersService } from './ticket-transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@ApiTags('ticket-transfers')
@Controller('tickets/transfers')
export class TicketTransfersController {
  constructor(private readonly transfers: TicketTransfersService) {}

  @Post()
  @ApiOperation({ summary: 'Request a ticket transfer between users' })
  create(@Body() dto: CreateTransferDto) {
    return this.transfers.create(dto);
  }

  @Post(':id/complete')
  @ApiOperation({
    summary:
      'Complete a pending transfer (cancel old QR, issue new ticket to receiver)',
  })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  complete(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.transfers.complete(id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending transfer' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  reject(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.transfers.reject(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending transfer' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  cancel(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.transfers.cancel(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transfer by ID' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.transfers.findOne(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get transfers involving a user (sent or received)' })
  @ApiParam({
    name: 'userId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByUser(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.transfers.findByUser(userId);
  }
}
