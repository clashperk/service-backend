import { ApiProperty } from '@nestjs/swagger';
import {
  APIBadge,
  APIClanWar,
  APIClanWarAttack,
  APIClanWarLeagueRound,
  APIClanWarMember,
  APIWarClan,
} from 'clashofclans.js';

export class ClanBadge implements APIBadge {
  large: string;
  small: string;
  medium: string;
}

export class ClanWarAttackDto implements APIClanWarAttack {
  attackerTag: string;
  defenderTag: string;
  stars: number;
  destructionPercentage: number;
  order: number;
  duration: number;
}

export class ClanWarMemberDto implements APIClanWarMember {
  attacks?: ClanWarAttackDto[];
  bestOpponentAttack?: ClanWarAttackDto;
  mapPosition: number;
  name: string;
  opponentAttacks: number;
  tag: string;
  townhallLevel: number;
}

export class WarClanDto implements APIWarClan {
  tag: string;
  name: string;
  badgeUrls: ClanBadge;
  clanLevel: number;
  attacks: number;
  stars: number;
  destructionPercentage: number;
  members: ClanWarMemberDto[];
}

export class ClanWarDto implements APIClanWar {
  @ApiProperty({ type: 'string' })
  state: 'notInWar' | 'preparation' | 'inWar' | 'warEnded';

  teamSize: number;
  startTime: string;
  preparationStartTime: string;

  @ApiProperty({ type: 'string' })
  battleModifier?: 'none' | 'hardMode';

  endTime: string;
  clan: WarClanDto;
  opponent: WarClanDto;
  attacksPerMember?: number;

  round: number;
  warTag: string;
}

export class ClanWarLeagueRound implements APIClanWarLeagueRound {
  warTags: string[];
}

export class ClanDto {
  tag: string;
  name: string;
  leagueId: number;
}

export class ClanWarLeaguesDto {
  season: string;
  rounds: ClanWarLeagueRound[];
  clans: ClanDto[];
  wars: ClanWarDto[];
}
