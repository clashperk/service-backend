import { ApiProperty } from '@nestjs/swagger';
import {
  APIBadge,
  APIClanWar,
  APIClanWarAttack,
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

export class ClanWarDto
  implements Omit<APIClanWar, 'startTime' | 'preparationStartTime' | 'endTime'>
{
  @ApiProperty({ type: 'string' })
  state: 'notInWar' | 'preparation' | 'inWar' | 'warEnded';

  teamSize: number;

  @ApiProperty({ type: 'string' })
  startTime: string | Date;

  @ApiProperty({ type: 'string' })
  preparationStartTime: string | Date;

  @ApiProperty({ type: 'string' })
  endTime: string | Date;

  clan: WarClanDto;
  opponent: WarClanDto;

  @ApiProperty({ nullable: true, type: 'string' })
  battleModifier?: 'none' | 'hardMode';

  @ApiProperty({ nullable: true })
  attacksPerMember?: number;

  @ApiProperty({ nullable: true })
  round?: number | null;

  @ApiProperty({ nullable: true })
  warTag?: string | null;

  result: string;
}
