import { ClanWarsEntity } from '@app/entities';
import { ApiProperty } from '@nestjs/swagger';

export class CWLMemberStatsOutput {
  name: string;
  tag: string;
  participated: number;
  attacks: number;
  stars: number;
  newStars: number;
  destruction: number;
  threeStars: number;
  twoStars: number;
  oneStar: number;
  zeroStars: number;
  missedAttacks: number;
  defenseStars: number;
  defenseDestruction: number;
  defenseCount: number;
}

export class CWLClansOutput {
  name: string;
  tag: string;
  leagueId: number;
}

export class CWLStatsOutput {
  season: string;

  @ApiProperty({ isArray: true, type: CWLClansOutput })
  clans: CWLClansOutput[];

  @ApiProperty({ isArray: true, type: CWLMemberStatsOutput })
  members: CWLMemberStatsOutput[];

  warTags: string[];

  @ApiProperty({ isArray: true })
  rounds: { warTags: string[] }[];

  @ApiProperty({ isArray: true })
  wars: ClanWarsEntity[];
}
