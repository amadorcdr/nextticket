import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('VenuesEventsService (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule =
      await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET)', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'venues-events-service',
      });
  });

  it('/venues (GET)', async () => {
    const response = await request(app.getHttpServer())
      .get('/venues')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('/venues/:id rejects invalid UUID (GET)', async () => {
    await request(app.getHttpServer())
      .get('/venues/not-a-valid-uuid')
      .expect(400);
  });
});
