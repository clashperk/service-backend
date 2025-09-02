import { ApiProperty } from '@nestjs/swagger';

class AttackRecordDto {
  stars: number;
  trueStars: number;
  defenderTag: string;
  destructionPercentage: number;

  @ApiProperty()
  defender: {
    tag: string;
    townhallLevel: number;
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
    townhallLevel: number;
    mapPosition: number;
  };

  @ApiProperty({ isArray: true, type: AttackRecordDto })
  attacks: AttackRecordDto[];
}
