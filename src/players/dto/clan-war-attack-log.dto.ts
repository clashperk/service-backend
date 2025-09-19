import { DateTime, EnumString } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';
import { WarTypes } from './war-types.enum';

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

  @EnumString(WarTypes, 'WarTypes', 'Regular = 1, Friendly = 2, CWL = 3')
  warType: WarTypes;

  @ApiProperty({ type: String, format: 'date-time' })
  startTime: string | Date;

  @ApiProperty({ type: String, format: 'date-time' })
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

export class AttackHistoryItemsDto {
  items: AttackHistoryDto[];
}

export class AggregateAttackHistoryDto {
  totalWars: number;
  totalAttacks: number;
  total3Stars: number;
  totalMissed: number;
  totalStars: number;
}
