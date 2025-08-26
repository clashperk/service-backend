import { Controller, Get } from '@nestjs/common';

@Controller('/clans')
export class ClansController {
  constructor() {}

  @Get('/:clanTag')
  getClanTag() {
    return Promise.resolve({});
  }
}
