import { TAG_REGEX } from '@app/constants';
import { ArrayMaxSize, IsArray, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export enum RankingBoard {
  PLAYERS = 'players',
  CLANS = 'clans',
  CAPITAL = 'capital',
  BUILDER_BASE_PLAYERS = 'builder-base-players',
  BUILDER_BASE_CLANS = 'builder-base-clans',
}

/** The boards ClashPerk saves each season; builder base boards are live only. */
export type SavedRankingBoard = RankingBoard.PLAYERS | RankingBoard.CLANS | RankingBoard.CAPITAL;

export class RankingLocationDto {
  /** A country code such as `IN`, or `global` for worldwide. */
  countryCode: string;
  name: string;
}

export class RankingLocationsDto {
  /** Global first, then countries by name. */
  items: RankingLocationDto[];
}

export class RankingSeasonsDto {
  /** Saved league seasons before the current one, newest first. */
  items: string[];
}

export class RankingBoardParamsDto {
  /** @example "IN" */
  @Matches(/^(global|[A-Z]{2})$/, { message: 'countryCode must be global or a country code' })
  countryCode: string;

  @IsEnum(RankingBoard)
  board: RankingBoard;
}

export class RankingBoardQueryDto {
  /**
   * A saved league season (from `/rankings/seasons`); the live board when left out.
   * @example "2026-09-07"
   */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}(-\d{2})?$/, { message: 'season must be YYYY-MM-DD' })
  season?: string;
}

export class RankingEntryDto {
  rank: number;
  /** Rank at the end of the season before; null when it wasn't ranked then or isn't known. */
  previousRank: number | null;
  tag: string;
  name: string;
  /** Trophies for player boards, points for clan boards. */
  score: number;
  /** Live boards only. */
  badgeUrl: string | null;
  /** A player's clan, on live player boards. */
  clan: { tag: string; name: string } | null;
}

export class RankingBoardDto {
  location: RankingLocationDto;
  board: RankingBoard;
  /** The saved season, or null for the live board. */
  season: string | null;
  items: RankingEntryDto[];
}

export class RankingStandingsInputDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(TAG_REGEX, { each: true })
  playerTags?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(TAG_REGEX, { each: true })
  clanTags?: string[];
}

export class RankingStandingDto {
  tag: string;
  name: string;
  board: RankingBoard;
  location: RankingLocationDto;
  rank: number;
  previousRank: number | null;
  score: number;
}

export class RankingStandingsDto {
  /** Where the tags stand this season, on every saved board they're on. */
  items: RankingStandingDto[];
}

export class ClanBoardStandingDto {
  board: RankingBoard;
  location: RankingLocationDto;
  /** Null when the clan isn't in this board's top 200. */
  rank: number | null;
  previousRank: number | null;
  /** Points of the board's last place: what it takes to get on it. */
  cutoff: number | null;
}

export class ClanRankingSeasonDto {
  season: string;
  /** Season-end rank in the clan's country; null when outside the top 200. */
  clans: number | null;
  capital: number | null;
}

export class ClanRankingsDto {
  /** The clan's country; null when it hasn't set one. */
  location: RankingLocationDto | null;
  /** Clans and capital boards, in its country (when set) and worldwide, this season. */
  boards: ClanBoardStandingDto[];
  /** Past seasons in its country, newest first, at most 6. */
  history: ClanRankingSeasonDto[];
}

export class PlayerRankingSeasonDto {
  season: string;
  location: RankingLocationDto;
  rank: number;
  trophies: number;
}

export class PlayerRankingsDto {
  /** Every saved season and board the player finished on, newest first. */
  items: PlayerRankingSeasonDto[];
}
