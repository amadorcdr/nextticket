import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3005;

  // transform: los query params llegan como string y los DTO de paginación
  // dependen de @Type(() => Number) y de sus valores por defecto.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Tickets Service')
    .setDescription('Tickets API with PostgreSQL + Redis and QR validation')
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger/tickets', app, document, {
    jsonDocumentUrl: 'api-json/tickets',
  });

  app.use(
    '/docs/tickets',
    apiReference({
      content: document,
    }),
  );

  app.enableCors({
    origin: [process.env.GATEWAY_URL ?? 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await app.listen(port);
  console.log(`tickets-service listening on http://localhost:${port}`);
  console.log(`Scalar docs at http://localhost:${port}/docs/tickets`);
  console.log(`OpenAPI JSON at http://localhost:${port}/api-json/tickets`);
}

void bootstrap();
