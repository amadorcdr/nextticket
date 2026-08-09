import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('describes the gateway and its proxied routes', () => {
      expect(appController.root()).toEqual(
        expect.objectContaining({
          service: 'api-gateway',
          routes: expect.any(Object),
        }),
      );
    });
  });

  describe('health', () => {
    it('reports ok status', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        service: 'api-gateway',
      });
    });
  });
});
