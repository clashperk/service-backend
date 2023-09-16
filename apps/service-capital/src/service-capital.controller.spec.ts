import { Test, TestingModule } from '@nestjs/testing';
import { ServiceCapitalController } from './service-capital.controller';
import { ServiceCapitalService } from './service-capital.service';

describe('ServiceCapitalController', () => {
  let serviceCapitalController: ServiceCapitalController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ServiceCapitalController],
      providers: [ServiceCapitalService],
    }).compile();

    serviceCapitalController = app.get<ServiceCapitalController>(ServiceCapitalController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(serviceCapitalController.getHello()).toBe('Hello World!');
    });
  });
});
