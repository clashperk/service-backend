import { Test, TestingModule } from '@nestjs/testing';
import { ServiceRankingController } from './service-ranking.controller';
import { RankingService } from './service-ranking.service';

describe('ServiceRankingController', () => {
  let serviceRankingController: ServiceRankingController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ServiceRankingController],
      providers: [RankingService],
    }).compile();

    serviceRankingController = app.get<ServiceRankingController>(ServiceRankingController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(serviceRankingController.getHello()).toBe('Hello World!');
    });
  });
});
