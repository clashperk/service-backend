import { Config } from '@app/constants';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller('/rosters')
@ApiExcludeController(Config.IS_PROD)
export class RostersController {
  constructor() {}

  @Get('/:rosterId')
  getRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }
}
