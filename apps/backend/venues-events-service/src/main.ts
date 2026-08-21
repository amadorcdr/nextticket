import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // ← NUEVO
import { apiReference } from '@scalar/nestjs-api-reference';       // ← NUEVO
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3003;
  // transform: los query params llegan como string y los DTO de paginación
  // dependen de @Type(() => Number) y de sus valores por defecto.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ← NUEVO: generar documento OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Venues & Events Service')
    .setDescription('API de recintos y eventos con PostgreSQL + Redis')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .build();

  // ← NUEVO: evita error de tipos duplicados con pnpm
  type NestApp = Parameters<typeof SwaggerModule.createDocument>[0];
  const nestApp = app as NestApp;

  const document = SwaggerModule.createDocument(nestApp, config);
  SwaggerModule.setup('swagger/venues', nestApp, document, {
    jsonDocumentUrl: 'api-json/venues',
  });

  // ← NUEVO: Scalar en /docs/venues
  app.use(
    '/docs/venues',
    apiReference({
      content: document,
    }),
  );

  // CORS: el navegador manda el Origin de la PÁGINA que hace la petición
  // (el frontend), no el del api-gateway al que en realidad llega la
  // petición proxiada — por eso esto compara contra FRONTEND_URL, nunca
  // contra GATEWAY_URL (esa variable es la URL pública de la API, se usa
  // para construir enlaces/URLs de imagen, no para esto).
  app.enableCors({
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:4000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await app.listen(port);
  console.log(`venues-events-service escuchando en http://localhost:${port}`);
  console.log(`Scalar docs en http://localhost:${port}/docs/venues`);
  console.log(`OpenAPI JSON en http://localhost:${port}/api-json/venues`);
}
bootstrap();
