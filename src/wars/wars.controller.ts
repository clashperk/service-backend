import { Cache } from '@app/decorators';
import { Controller, Get, Param } from '@nestjs/common';
import { WarsService } from './wars.service';

@Controller('/wars')
export class WarsController {
  constructor(private warsService: WarsService) {}

  @Get('/:clanTag/clan-war-league')
  @Cache(60 * 5)
  async getClanWar(@Param('clanTag') clanTag: string) {
    return this.warsService.getClanWarLeague(clanTag);
  }
}
