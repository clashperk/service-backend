import { NumberString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { Max, Min } from 'class-validator';

export class CapitalRaidsInputDto {
  @NumberString(5)
  @Max(60)
  @Min(1)
  @ApiProperty({ required: false, default: 5, minimum: 1, maximum: 60 })
  limit: number = 5;
}

export class CapitalRaidMemberDto {
  name: string;
  tag: string;
  attacks: number;
  attackLimit: number;
  bonusAttackLimit: number;
  capitalResourcesLooted: number;
}

export class CapitalRaidSeasonDto {
  name: string;
  tag: string;
  state: string;
  members: CapitalRaidMemberDto[];
  startDate: Date;
  endDate: Date;
  offensiveReward: number;
  defensiveReward: number;
  capitalTotalLoot: number;
  totalAttacks: number;
  enemyDistrictsDestroyed: number;
  raidsCompleted: number;
}

export class CapitalRaidsDto {
  items: CapitalRaidSeasonDto[];
}
