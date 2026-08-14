import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3002;
  // transform: los query params llegan como string y los DTO de paginación
  // dependen de @Type(() => Number) y de sus valores por defecto.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // ← NUEVO: generar documento OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Auth Service')
    .setDescription('API de autenticación con PostgreSQL + Redis')
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

  type NestApp = Parameters<typeof SwaggerModule.createDocument>[0];
  const nestApp = app as NestApp;

  const document = SwaggerModule.createDocument(nestApp, config);
  SwaggerModule.setup('swagger/auth', nestApp, document, {
    jsonDocumentUrl: 'api-json/auth',
  });

  app.use(
    '/docs/auth',
    apiReference({
      content: document,
    }),
  );

  app.enableCors({
    origin: [process.env.GATEWAY_URL ?? 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await app.listen(port);
  console.log(`auth-service escuchando en http://localhost:${port}`);
  console.log(`Scalar docs en http://localhost:${port}/docs/auth`);
  console.log(`OpenAPI JSON en http://localhost:${port}/api-json/auth`);
}
bootstrap();
