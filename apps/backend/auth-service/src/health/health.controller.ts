import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger'; // ← NUEVO

@ApiTags('health') // ← NUEVO
@Controller('health')
export class HealthController {
    @Get()
    @ApiOperation({ summary: 'Health check del servicio' }) // ← NUEVO
    check() {
        return { status: 'ok', service: 'auth-service' };
    }
}
