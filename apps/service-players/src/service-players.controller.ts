import { Controller, Get } from '@nestjs/common';
import { PlayersService } from './service-players.service';

@Controller()
export class ServicePlayersController {
  constructor(private readonly servicePlayersService: PlayersService) {}

  @Get()
  getHello(): string {
    return this.servicePlayersService.getHello();
  }
}
