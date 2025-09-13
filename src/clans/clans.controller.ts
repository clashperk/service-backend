import { Cache } from '@app/decorators';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { ClansService } from './clans.service';

@Controller('/clans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Get('/:clanTag')
  getClanTag() {
    return Promise.resolve({});
  }

  @Get('/:clanTag/lastseen')
  @Cache(60)
  async getLastSeen(@Param('clanTag') clanTag: string) {
    return this.clansService.getLastSeen(clanTag);
  }
}
