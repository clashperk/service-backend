import { Test, TestingModule } from '@nestjs/testing';
import { ServiceClansController } from './service-clans.controller';
import { ServiceClansService } from './service-clans.service';

describe('ServiceClansController', () => {
  let serviceClansController: ServiceClansController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ServiceClansController],
      providers: [ServiceClansService],
    }).compile();

    serviceClansController = app.get<ServiceClansController>(ServiceClansController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(serviceClansController.getHello()).toBe('Hello World!');
    });
  });
});
