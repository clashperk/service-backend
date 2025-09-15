import { ApiProperty } from '@nestjs/swagger';

export class LastSeenMemberClan {
  name: string;
  tag: string;
}

export class LastSeenMemberDto {
  name: string;
  tag: string;

  @ApiProperty({ required: false })
  clan?: LastSeenMemberClan;

  lastSeen: Date;
  leagueId: number;
  townHallLevel: number;
  scores: { last24h: number; last30d: number };
}

export class LastSeenDto {
  items: LastSeenMemberDto[];
}
