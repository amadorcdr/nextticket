import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { PurchasesController } from '../src/purchases/purchases.controller';
import { PurchasesService } from '../src/purchases/purchases.service';

describe('PurchasesController (e2e)', () => {
  let app: INestApplication<App>;
  const purchasesService = {
    findAll: jest.fn(),
    createTemporaryBlock: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    purchasesService.findAll.mockResolvedValue([]);
    purchasesService.createTemporaryBlock.mockResolvedValue({ id: 'block-id' });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PurchasesController],
      providers: [{ provide: PurchasesService, useValue: purchasesService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/purchases (GET)', () => {
    return request(app.getHttpServer())
      .get('/purchases')
      .expect(200)
      .expect([]);
  });

  it('/purchases/temporary-blocks (POST)', () => {
    return request(app.getHttpServer())
      .post('/purchases/temporary-blocks')
      .send({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        eventZoneId: '550e8400-e29b-41d4-a716-446655440001',
        eventSeatId: '550e8400-e29b-41d4-a716-446655440002',
      })
      .expect(201)
      .expect({ id: 'block-id' });
  });
});
