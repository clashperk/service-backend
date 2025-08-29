import { Controller, Get, Param } from '@nestjs/common';

@Controller('/rosters')
export class RostersController {
  constructor() {}

  @Get('/:rosterId')
  getRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }
}
