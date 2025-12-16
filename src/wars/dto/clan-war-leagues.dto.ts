import { APIClanWarLeagueRound } from 'clashofclans.js';
import { ClanWarDto } from './clan-wars.dto';

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
