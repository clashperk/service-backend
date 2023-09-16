import { Test, TestingModule } from '@nestjs/testing';
import { ServiceWarsController } from './service-wars.controller';
import { ServiceWarsService } from './service-wars.service';

describe('ServiceWarsController', () => {
  let serviceWarsController: ServiceWarsController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ServiceWarsController],
      providers: [ServiceWarsService],
    }).compile();

    serviceWarsController = app.get<ServiceWarsController>(ServiceWarsController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(serviceWarsController.getHello()).toBe('Hello World!');
    });
  });
});
