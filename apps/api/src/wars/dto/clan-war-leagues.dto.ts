import { ClanWarDto } from '@app/clash-client/dto';
import { NumberString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { Max, Min } from 'class-validator';
import { APIClanWarLeagueRound } from 'clashofclans.js';
import { ClanWarSideDto } from './clan-war-list.dto';

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

export class ClanWarLeagueSeasonsInputDto {
  @NumberString(3)
  @Max(12)
  @Min(1)
  @ApiProperty({ required: false, default: 3, minimum: 1, maximum: 12 })
  limit: number = 3;
}

export class ClanWarLeagueRoundDto {
  /** Position in the group's schedule; null when the group wasn't stored. */
  @ApiProperty({ type: 'number', nullable: true })
  round: number | null;

  id: number;

  @ApiProperty({ type: 'string' })
  state: 'preparation' | 'inWar' | 'warEnded';

  teamSize: number;

  @ApiProperty({ type: String, format: 'date-time' })
  startTime: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  endTime: Date;

  @ApiProperty({ type: 'string' })
  result: 'win' | 'lose' | 'tie';

  clan: ClanWarSideDto;
  opponent: ClanWarSideDto;
}

export class ClanWarLeagueMemberDto {
  tag: string;
  name: string;
  /** From the member's latest war in the season. */
  townHallLevel: number;
  /** Rounds the member was in the lineup for. */
  wars: number;
  attacks: number;
  stars: number;
  threeStars: number;
  /** Sum over attacks; divide by `attacks` for the average. */
  destruction: number;
  /** Ended rounds the member was in without attacking. */
  missed: number;
}

export class ClanWarLeagueSeasonDto {
  season: string;

  /** The clan's war league that season; null when the group wasn't stored. */
  @ApiProperty({ type: 'number', nullable: true })
  leagueId: number | null;

  /** Clans in the group; null when the group wasn't stored. */
  @ApiProperty({ type: 'number', nullable: true })
  groupSize: number | null;

  rounds: ClanWarLeagueRoundDto[];

  /** Most stars first. */
  members: ClanWarLeagueMemberDto[];
}

export class ClanWarLeagueSeasonsDto {
  /** Newest season first. */
  items: ClanWarLeagueSeasonDto[];
}
