import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { TicketValidationsService } from './ticket-validations.service';
import { CreateValidationDto } from './dto/create-validation.dto';

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
  findByTicket(@Param('ticketId') ticketId: string) {
    return this.validations.findByTicket(ticketId);
  }

  @Get('validator/:validatorId')
  @ApiOperation({ summary: 'Get validations performed by a specific validator' })
  @ApiParam({
    name: 'validatorId',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  findByValidator(@Param('validatorId') validatorId: string) {
    return this.validations.findByValidator(validatorId);
  }
}
