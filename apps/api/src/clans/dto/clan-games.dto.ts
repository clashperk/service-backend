import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class ClanGamesInputDto {
  /** `YYYY-MM`; defaults to the latest Clan Games (last month's until the 20th). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  @ApiProperty({ required: false, example: '2026-10' })
  season?: string;
}

export class ClanGamesMemberDto {
  name: string;
  tag: string;
  points: number;

  @ApiProperty({ type: 'string', format: 'date-time', nullable: true })
  completedAt: Date | null;
}

export class ClanGamesDto {
  season: string;
  startTime: Date;
  endTime: Date;
  /** Most points one member can earn. */
  maxPoints: number;
  /** Sum of each member's points, capped at `maxPoints`. */
  totalPoints: number;
  members: ClanGamesMemberDto[];
}
