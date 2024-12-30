import { ApiProperty } from '@nestjs/swagger';

export class AttackRecord {
  stars: number;
  defenderTag: string;
  destructionPercentage: number;

  @ApiProperty()
  defender: {
    tag: string;
    townhallLevel: number;
    mapPosition: number;
  };
}

export class AttackHistoryOutput {
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

  @ApiProperty({ isArray: true, type: AttackRecord })
  attacks: AttackRecord[];
}
