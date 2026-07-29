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
    it('should identify itself as the gateway', () => {
      expect(appController.root().service).toBe('api-gateway');
    });

    it('should publish one route per proxied prefix', () => {
      const routes = Object.keys(appController.root().routes);

      expect(routes).toEqual(
        expect.arrayContaining([
          '/users',
          '/venues',
          '/events',
          '/event-categories',
          '/purchases',
          '/tickets',
          '/health',
        ]),
      );
    });

    it('should point every route to its own microservice', () => {
      const routes = appController.root().routes;

      expect(routes['/users']).toContain('auth-service');
      expect(routes['/venues']).toContain('venues-events-service');
      expect(routes['/events']).toContain('venues-events-service');
      expect(routes['/event-categories']).toContain('venues-events-service');
      expect(routes['/purchases']).toContain('purchases-service');
      expect(routes['/tickets']).toContain('tickets-service');
    });
  });

  describe('health', () => {
    it('should report the gateway as ok', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        service: 'api-gateway',
      });
    });
  });
});
