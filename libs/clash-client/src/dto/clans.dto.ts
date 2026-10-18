import { ApiProperty } from '@nestjs/swagger';
import { APIClan, APIClanCapital, APIClanMember } from 'clashofclans.js';
import { ClanBadge } from './clan-wars.dto';
import {
  ChatLanguageDto,
  LabelDto,
  LeagueTierDto,
  LocationDto,
  NamedLeagueDto,
  PlayerHouseDto,
} from './common.dto';

export class ClanMemberDto implements APIClanMember {
  name: string;
  tag: string;

  @ApiProperty({ enum: ['member', 'admin', 'coLeader', 'leader'] })
  role: 'member' | 'admin' | 'coLeader' | 'leader';

  expLevel: number;
  townHallLevel: number;
  leagueTier: LeagueTierDto;
  builderBaseLeague?: NamedLeagueDto;
  trophies: number;
  builderBaseTrophies?: number;
  clanRank: number;
  previousClanRank: number;
  donations: number;
  donationsReceived: number;
  playerHouse?: PlayerHouseDto;
}

export class ClanCapitalDistrictDto {
  id: number;
  name: string;
  districtHallLevel: number;
}

export class ClanCapitalDto implements APIClanCapital {
  capitalHallLevel?: number;
  districts?: ClanCapitalDistrictDto[];
}

/** Live clan profile from the Clash of Clans API. */
export class ClanDto implements APIClan {
  tag: string;
  name: string;

  @ApiProperty({ enum: ['open', 'inviteOnly', 'closed'] })
  type: 'open' | 'inviteOnly' | 'closed';

  description: string;
  location?: LocationDto;
  chatLanguage?: ChatLanguageDto;
  badgeUrls: ClanBadge;
  clanLevel: number;
  clanPoints: number;
  clanBuilderBasePoints: number;
  requiredTrophies: number;
  requiredTownhallLevel?: number;
  requiredBuilderBaseTrophies?: number;

  @ApiProperty({
    enum: [
      'always',
      'moreThanOncePerWeek',
      'oncePerWeek',
      'lessThanOncePerWeek',
      'never',
      'unknown',
    ],
    required: false,
  })
  warFrequency?:
    | 'always'
    | 'moreThanOncePerWeek'
    | 'oncePerWeek'
    | 'lessThanOncePerWeek'
    | 'never'
    | 'unknown';

  warWinStreak: number;
  warWins: number;
  warTies?: number;
  warLosses?: number;
  isWarLogPublic: boolean;
  warLeague?: NamedLeagueDto;
  members: number;
  labels: LabelDto[];
  memberList: ClanMemberDto[];
  clanCapital: ClanCapitalDto;
  isFamilyFriendly: boolean;
  clanCapitalPoints: number;
  capitalLeague?: NamedLeagueDto;
}
