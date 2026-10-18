import { ApiProperty } from '@nestjs/swagger';
import {
  APILegendStatistics,
  APIPlayer,
  APIPlayerAchievement,
  APIPlayerClan,
  APIPlayerItem,
  APISeason,
} from 'clashofclans.js';
import { ClanBadge } from './clan-wars.dto';
import { LabelDto, LeagueTierDto, NamedLeagueDto, PlayerHouseDto } from './common.dto';

export class PlayerClanDto implements APIPlayerClan {
  tag: string;
  name: string;
  clanLevel: number;
  badgeUrls: ClanBadge;
}

export class PlayerSeasonDto implements APISeason {
  id: string;
  rank: number;
  trophies: number;
}

/** The live API sends only `trophies` for the season in progress. */
export class PlayerCurrentSeasonDto implements Partial<APISeason> {
  id?: string;
  rank?: number;
  trophies: number;
}

export class LegendStatisticsDto implements Omit<APILegendStatistics, 'currentSeason'> {
  previousSeason?: PlayerSeasonDto;
  previousBuilderBaseSeason?: PlayerSeasonDto;
  bestBuilderBaseSeason?: PlayerSeasonDto;
  currentSeason?: PlayerCurrentSeasonDto;
  bestSeason?: PlayerSeasonDto;
  legendTrophies: number;
}

export class PlayerAchievementDto implements APIPlayerAchievement {
  name: string;
  stars: number;
  value: number;
  target: number;
  info: string;

  @ApiProperty({ type: 'string', nullable: true })
  completionInfo: string | null;

  @ApiProperty({ enum: ['home', 'builderBase'] })
  village: 'home' | 'builderBase';
}

export class PlayerItemDto implements APIPlayerItem {
  name: string;
  level: number;
  maxLevel: number;
  superTroopIsActive?: boolean;

  @ApiProperty({ type: () => [PlayerItemDto], required: false })
  equipment?: PlayerItemDto[];

  @ApiProperty({ enum: ['home', 'builderBase'] })
  village: 'home' | 'builderBase';
}

/** Live player profile from the Clash of Clans API. */
export class PlayerDto implements Omit<APIPlayer, 'legendStatistics'> {
  name: string;
  tag: string;
  townHallLevel: number;
  townHallWeaponLevel?: number;
  expLevel: number;
  trophies: number;
  bestTrophies: number;
  warStars: number;
  attackWins: number;
  defenseWins: number;
  builderHallLevel?: number;
  builderBaseTrophies?: number;
  bestBuilderBaseTrophies?: number;
  donations: number;
  donationsReceived: number;
  clanCapitalContributions: number;
  role?: string;

  @ApiProperty({ enum: ['in', 'out'], required: false })
  warPreference?: 'in' | 'out';

  clan?: PlayerClanDto;
  leagueTier: LeagueTierDto;
  builderBaseLeague?: NamedLeagueDto;
  currentLeagueGroupTag: string;
  currentLeagueSeasonId: number;
  previousLeagueGroupTag: string;
  previousLeagueSeasonId: number;
  legendStatistics?: LegendStatisticsDto;
  achievements: PlayerAchievementDto[];
  troops: PlayerItemDto[];
  heroes: PlayerItemDto[];
  spells: PlayerItemDto[];
  heroEquipment: PlayerItemDto[];
  labels: LabelDto[];
  playerHouse?: PlayerHouseDto;
}
