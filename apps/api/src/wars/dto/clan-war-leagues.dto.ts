import { ClanWarDto } from '@app/clash-client/dto';
import { APIClanWarLeagueRound } from 'clashofclans.js';

export class ClanWarLeagueRound implements APIClanWarLeagueRound {
  warTags: string[];
}

export class LeagueGroupClanDto {
  tag: string;
  name: string;
  leagueId: number;
}

export class ClanWarLeaguesDto {
  season: string;
  rounds: ClanWarLeagueRound[];
  clans: LeagueGroupClanDto[];
  wars: ClanWarDto[];
}
