import { DateTime } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';

export class AttackHistoryInputDto {
  @DateTime()
  startDate: number;
}

class AttackRecordDto {
  stars: number;
  trueStars: number;
  defenderTag: string;
  destructionPercentage: number;

  @ApiProperty()
  defender: {
    tag: string;
    townHallLevel: number;
    mapPosition: number;
  };
}

export class AttackHistoryDto {
  id: number;
  warType: number;
  startTime: string | Date;
  endTime: string | Date;
  clan: {
    name: string;
    tag: string;
  };
  opponent: {
    name: string;
    tag: string;
  };
  attacker: {
    name: string;
    tag: string;
    townHallLevel: number;
    mapPosition: number;
  };
  attacksPerMember: number;
  teamSize: number;

  @ApiProperty({ isArray: true, type: AttackRecordDto })
  attacks: AttackRecordDto[];
}

export class AggregateAttackHistoryDto {
  totalWars: number;
  totalAttacks: number;
  total3Stars: number;
  totalMissed: number;
  totalStars: number;
}
