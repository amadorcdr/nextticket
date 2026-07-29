import { NestFactory } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const port = process.env.PORT ?? 3001;

  app.enableCors({ origin: '*' });

  const proxies = [
    // auth-service
    {
      target: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3002',
      prefixes: ['/users', '/docs/auth', '/api-json/auth', '/swagger/auth'],
    },
    // venues-events-service
    {
      target: process.env.VENUES_SERVICE_URL ?? 'http://localhost:3003',
      prefixes: [
        '/venues',
        '/events',
        '/event-categories',
        '/docs/venues',
        '/api-json/venues',
        '/swagger/venues',
      ],
    },
    // purchases-service
    {
      target: process.env.PURCHASES_SERVICE_URL ?? 'http://localhost:3004',
      prefixes: ['/purchases', '/docs/purchases', '/api-json/purchases', '/swagger/purchases'],
    },
    // tickets-service
    {
      target: process.env.TICKETS_SERVICE_URL ?? 'http://localhost:3005',
      prefixes: ['/tickets', '/docs/tickets', '/api-json/tickets', '/swagger/tickets'],
    },
  ];

  for (const proxy of proxies) {
    app.use(
      createProxyMiddleware({
        target: proxy.target,
        changeOrigin: true,
        pathFilter: (pathname) =>
          proxy.prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
      }),
    );
  }

  await app.listen(port);
  console.log(`api-gateway escuchando en http://localhost:${port}`);
}
bootstrap();