import { getAppHealth } from '@app/helper';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { CapitalService } from './service-capital.service';

@Controller()
export class ServiceCapitalController {
  constructor(private readonly capitalService: CapitalService) {}

  @Get()
  ack() {
    return { message: 'Hello from service-capital' };
  }

  @Get('/health')
  stats() {
    return getAppHealth('service-capital');
  }

  @Get('/clans/:clanTag')
  getCapitalRaidSeason(@Param('clanTag') clanTag: string, @Query('weekId') weekId?: string) {
    return this.capitalService.getCapitalRaidWeekend(clanTag, weekId);
  }
}
