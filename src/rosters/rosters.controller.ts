import { Controller, Get } from '@nestjs/common';

@Controller('/rosters')
export class RostersController {
  constructor() {}

  @Get('/:rosterId')
  getRoster() {
    return Promise.resolve({});
  }
}
