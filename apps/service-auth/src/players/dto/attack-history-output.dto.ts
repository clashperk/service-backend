import { ApiProperty } from '@nestjs/swagger';

export class AttackHistoryAggregated {
  id: number;
  warType: number;
  startTime: string;
  endTime: string;
  clan: {
    name: string;
    tag: string;
  };
  opponent: {
    name: string;
    tag: string;
  };
  members: {
    name: string;
    tag: string;
    townhallLevel: number;
    mapPosition: number;
    attacks?: {
      stars: number;
      defenderTag: string;
      destructionPercentage: number;
    }[];
  }[];
  defenders: {
    tag: string;
    townhallLevel: number;
    mapPosition: number;
  }[];
}

export class AttackRecord {
  stars: number;
  defenderTag: string;
  destructionPercentage: number;

  @ApiProperty({ nullable: true })
  defender: {
    tag: string;
    townhallLevel: number;
    mapPosition: number;
  } | null;
}

export class AttackHistoryOutput {
  id: number;
  warType: number;
  startTime: string;
  endTime: string;
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
