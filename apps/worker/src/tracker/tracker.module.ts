import { Global, Module } from '@nestjs/common';
import { CapitalRaidService } from './capital-raid.service';
import { ClansService } from './clans.service';
import { PlayersService } from './players.service';
import { RankingService } from './ranking.service';
import { WarsService } from './wars.service';

@Global()
@Module({
  providers: [ClansService, PlayersService, WarsService, CapitalRaidService, RankingService],
})
export class TrackerModule {}
