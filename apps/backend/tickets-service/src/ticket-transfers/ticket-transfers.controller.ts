import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TicketTransfersService } from './ticket-transfers.service';

@ApiTags('ticket-transfers')
@Controller('tickets/transfers')
export class TicketTransfersController {
  constructor(private readonly transfers: TicketTransfersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Request a ticket transfer between users' })
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.transfers.create(dto, user.sub);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary:
      'Complete a pending transfer (cancel old QR, issue new ticket to receiver)',
  })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transfers.complete(id, user.sub);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Reject a pending transfer' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transfers.reject(id, user.sub);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Cancel a pending transfer' })
  @ApiParam({ name: 'id', example: '550e8400-e29b-41d4-a716-446655440000' })
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transfers.cancel(id, user.sub);
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
