import { Cache } from '@app/decorators';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { WarsService } from './wars.service';

@Controller('/wars')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WarsController {
  constructor(private warsService: WarsService) {}

  @Get('/:clanTag/clan-war-league')
  @Cache(60 * 5)
  async getClanWar(@Param('clanTag') clanTag: string) {
    return this.warsService.getClanWarLeague(clanTag);
  }
}
