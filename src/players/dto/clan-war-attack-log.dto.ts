import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber } from 'class-validator';
import moment from 'moment';

export class AttackHistoryInputDto {
  @ApiProperty({ type: 'string', format: 'date-time', required: false })
  @Transform(({ value }: { value: string }) => {
    if (!value) return null;
    if (/^\d+$/.test(value)) return Number(value);
    return moment(value).isValid() ? moment(value).toDate().getTime() : null;
  })
  @IsNumber()
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
