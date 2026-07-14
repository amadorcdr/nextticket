import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'; // ← NUEVO
import { apiReference } from '@scalar/nestjs-api-reference';       // ← NUEVO
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3001;
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // ← NUEVO: generar documento OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Tasks Service')
    .setDescription('API de tareas con PostgreSQL + Redis')
    .setVersion('1.0')
    .build();

  // ← NUEVO: evita error de tipos duplicados con pnpm
  type NestApp = Parameters<typeof SwaggerModule.createDocument>[0];
  const nestApp = app as NestApp;

  const document = SwaggerModule.createDocument(nestApp, config);
  SwaggerModule.setup('api', nestApp, document); // Swagger UI en /api (opcional)

  // ← NUEVO: Scalar en /docs (sin theme: 'nestjs' — ya no existe en Scalar 1.2.x)
  app.use(
    '/docs',
    apiReference({
      content: document,
    }),
  );

  await app.listen(port);
  console.log(`tasks-service escuchando en http://localhost:${port}`);
  console.log(`Scalar docs en http://localhost:${port}/docs`);      // ← NUEVO
  console.log(`OpenAPI JSON en http://localhost:${port}/api-json`); // ← NUEVO
}
bootstrap();