import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      service: 'api-gateway',
      description: 'Punto único de entrada. Reenvía el tráfico a los microservicios.',
      routes: {
        '/users': `${process.env.AUTH_SERVICE_URL ?? 'http://localhost:3002'}/users (auth-service)`,
        '/venues': `${process.env.VENUES_SERVICE_URL ?? 'http://localhost:3003'}/venues (venues-events-service)`,
        '/events': `${process.env.VENUES_SERVICE_URL ?? 'http://localhost:3003'}/events (venues-events-service)`,
        '/event-categories': `${process.env.VENUES_SERVICE_URL ?? 'http://localhost:3003'}/event-categories (venues-events-service)`,
        '/purchases': `${process.env.PURCHASES_SERVICE_URL ?? 'http://localhost:3004'}/purchases (purchases-service)`,
        '/tickets': `${process.env.TICKETS_SERVICE_URL ?? 'http://localhost:3005'}/tickets (tickets-service)`,
        '/docs/...': `Scalar docs: /docs/auth, /docs/venues, /docs/purchases, /docs/tickets`,
        '/api-json/...': `OpenAPI JSON: /api-json/auth, /api-json/venues, /api-json/purchases, /api-json/tickets`,
        '/swagger/...': `Swagger UI: /swagger/auth, /swagger/venues, /swagger/purchases, /swagger/tickets`,
        '/health': 'estado del propio gateway',
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'api-gateway' };
  }
}