import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CreateValidationDto } from './dto/create-validation.dto';
import { TicketValidationsService } from './ticket-validations.service';

@ApiTags('ticket-validations')
@Controller('tickets/validations')
export class TicketValidationsController {
  constructor(private readonly validations: TicketValidationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Validate a ticket by scanning its QR code hash',
  })
  validate(@Body() dto: CreateValidationDto) {
    return this.validations.validate(dto);
  }

  @Get('ticket/:ticketId')
  @ApiOperation({ summary: 'Get validation history for a ticket' })
  @ApiParam({
    name: 'ticketId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByTicket(
    @Param('ticketId', new ParseUUIDPipe()) ticketId: string,
  ) {
    return this.validations.findByTicket(ticketId);
  }

  @Get('validator/:validatorId')
  @ApiOperation({ summary: 'Get validations performed by a specific validator' })
  @ApiParam({
    name: 'validatorId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByValidator(
    @Param('validatorId', new ParseUUIDPipe()) validatorId: string,
  ) {
    return this.validations.findByValidator(validatorId);
  }
}
