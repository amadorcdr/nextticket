import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    const authUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:3002';
    const venuesUrl =
      process.env.VENUES_SERVICE_URL ?? 'http://localhost:3003';
    const purchasesUrl =
      process.env.PURCHASES_SERVICE_URL ?? 'http://localhost:3004';
    const ticketsUrl =
      process.env.TICKETS_SERVICE_URL ?? 'http://localhost:3005';

    return {
      service: 'api-gateway',
      description:
        'Punto unico de entrada. Reenvia el trafico a los microservicios.',
      routes: {
        '/auth': `${authUrl}/auth (auth-service)`,
        '/users': `${authUrl}/users (auth-service)`,
        '/venues': `${venuesUrl}/venues (venues-events-service)`,
        '/events': `${venuesUrl}/events (venues-events-service)`,
        '/event-categories': `${venuesUrl}/event-categories (venues-events-service)`,
        '/purchases': `${purchasesUrl}/purchases (purchases-service)`,
        '/tickets': `${ticketsUrl}/tickets (tickets-service)`,
        '/docs/...':
          'Scalar docs: /docs/auth, /docs/venues, /docs/purchases, /docs/tickets',
        '/api-json/...':
          'OpenAPI JSON: /api-json/auth, /api-json/venues, /api-json/purchases, /api-json/tickets',
        '/swagger/...':
          'Swagger UI: /swagger/auth, /swagger/venues, /swagger/purchases, /swagger/tickets',
        '/health': 'estado del propio gateway',
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok', service: 'api-gateway' };
  }
}
