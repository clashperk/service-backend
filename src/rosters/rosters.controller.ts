import { ApiExcludeRoute } from '@app/decorators';
import { Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { RostersService } from './rosters.service';

@Controller('/rosters')
@ApiExcludeRoute()
export class RostersController {
  constructor(private rostersService: RostersService) {}

  @Get('/:guildId/:rosterId')
  getRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Get('/:guildId/:rosterId/list')
  getRosters(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Post('/:guildId/create')
  createRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Patch('/:guildId/:rosterId')
  updateRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Delete('/:guildId/:rosterId')
  deleteRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Post('/:guildId/:rosterId/clone')
  cloneRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Put('/:guildId/:rosterId/members')
  addRosterMembers(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Delete('/:guildId/:rosterId/members')
  deleteRosterMembers(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Post('/:guildId/:rosterId/members/refresh')
  refreshRosterMembers(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }

  @Put('/:guildId/:rosterId/members/transfer')
  manageRoster(@Param('rosterId') rosterId: string) {
    return Promise.resolve({ rosterId });
  }
}
