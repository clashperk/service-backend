import { ClanBadge, ClanWarDto } from '@app/clash-client/dto';
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

/** One member's totals over a set of the clan's wars. */
export class ClanWarMemberTotalsDto {
  tag: string;
  name: string;
  /** From the member's latest war in the set. */
  townHallLevel: number;
  /** Wars the member was in the lineup for. */
  wars: number;
  attacks: number;
  stars: number;
  threeStars: number;
  /** Sum over attacks; divide by `attacks` for the average. */
  destruction: number;
  /** Attacks left unused in ended wars. */
  missed: number;
  /** Attacks on a base of the same or a higher Town Hall. */
  sameThAttacks: number;
  sameThThreeStars: number;
}

export class ClanWarLeagueSeasonDto {
  season: string;

  /** The stored group (for standings); null when it wasn't stored. */
  @ApiProperty({ type: 'number', nullable: true })
  groupId: number | null;

  /** The game's season id for the group, e.g. "2026-10-02"; null when the group wasn't stored. */
  @ApiProperty({ type: 'string', nullable: true })
  groupSeason: string | null;

  /** The clan's war league that season; null when the group wasn't stored. */
  @ApiProperty({ type: 'number', nullable: true })
  leagueId: number | null;

  /** Clans in the group; null when the group wasn't stored. */
  @ApiProperty({ type: 'number', nullable: true })
  groupSize: number | null;

  rounds: ClanWarLeagueRoundDto[];

  /** Most stars first. */
  members: ClanWarMemberTotalsDto[];
}

export class ClanWarLeagueSeasonsDto {
  /** Newest season first. */
  items: ClanWarLeagueSeasonDto[];
}

export class ClanWarLeagueStandingDto {
  tag: string;
  name: string;
  @ApiProperty({ type: () => ClanBadge, nullable: true })
  badgeUrls: ClanBadge | null;
  /** Stars plus 10 per war won, as the game ranks them. */
  stars: number;
  /** Total destruction over all wars: each war's percentage times its size. */
  destruction: number;
  wins: number;
  /** League at the start of the season. */
  leagueId: number;
}

export class ClanWarLeagueStandingsDto {
  groupId: number;
  season: string;
  /** Rounds with at least one war started. */
  roundsPlayed: number;
  totalRounds: number;
  /** False when some wars no longer load from the game, so the table is partial. */
  complete: boolean;
  /** Best first. */
  rows: ClanWarLeagueStandingDto[];
}
