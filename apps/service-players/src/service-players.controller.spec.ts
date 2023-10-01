import { Test, TestingModule } from '@nestjs/testing';
import { ServicePlayersController } from './service-players.controller';
import { PlayersService } from './service-players.service';

describe('ServicePlayersController', () => {
  let servicePlayersController: ServicePlayersController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ServicePlayersController],
      providers: [PlayersService],
    }).compile();

    servicePlayersController = app.get<ServicePlayersController>(ServicePlayersController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(servicePlayersController.getHello()).toBe('Hello World!');
    });
  });
});
