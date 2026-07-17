import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3004;

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = new DocumentBuilder()
    .setTitle('Purchases Service')
    .setDescription('API de compras con PostgreSQL + Redis')
    .setVersion('1.0')
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

  app.enableCors({
    origin: [process.env.GATEWAY_URL ?? 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  });

  await app.listen(port);
  console.log(`purchases-service escuchando en http://localhost:${port}`);
  console.log(`Scalar docs en http://localhost:${port}/docs/purchases`);
  console.log(`OpenAPI JSON en http://localhost:${port}/api-json/purchases`);
}

void bootstrap();
