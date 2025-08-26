import { Controller, Get } from '@nestjs/common';

@Controller('/wars')
export class WarsController {
  constructor() {}

  @Get('/:clanTag')
  getClanWar() {
    return Promise.resolve({});
  }
}
