import { Controller, Get } from '@nestjs/common';

@Controller('/players')
export class PlayersController {
  constructor() {}

  @Get('/:playerTag')
  getPlayerTag() {
    return Promise.resolve({});
  }
}
