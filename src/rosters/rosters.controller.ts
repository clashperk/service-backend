import { PRODUCTION_MODE } from '@app/constants';
import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

@Controller('/rosters')
@ApiExcludeController(PRODUCTION_MODE)
export class RostersController {
  constructor() {}

  @Get('/:rosterId')
  getRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }
}
