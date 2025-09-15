import { Cache } from '@app/decorators';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth';
import { ClansService } from './clans.service';
import { LastSeenDto } from './dto';

@Controller('/clans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClansController {
  constructor(private clansService: ClansService) {}

  @Get('/:clanTag/lastseen')
  @Cache(60)
  async getLastSeen(@Param('clanTag') clanTag: string): Promise<LastSeenDto> {
    return this.clansService.getLastSeen(clanTag);
  }
}
