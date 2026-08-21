import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

// Purchase.folio is a BigInt; JSON.stringify cannot serialize BigInt natively,
// so responses would throw without this global serializer.
(BigInt.prototype as unknown as { toJSON(): string }).toJSON = function (
  this: bigint,
) {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3004;

  // transform: los query params llegan como string y los DTO de paginación
  // dependen de @Type(() => Number) y de sus valores por defecto.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Purchases Service')
    .setDescription('API de compras con PostgreSQL + Redis')
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
  SwaggerModule.setup('swagger/purchases', app, document, {
    jsonDocumentUrl: 'api-json/purchases',
  });

  app.use(
    '/docs/purchases',
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
  console.log(`purchases-service escuchando en http://localhost:${port}`);
  console.log(`Scalar docs en http://localhost:${port}/docs/purchases`);
  console.log(`OpenAPI JSON en http://localhost:${port}/api-json/purchases`);
}

void bootstrap();
