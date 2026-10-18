import { ApiProperty } from '@nestjs/swagger';

export class GameEventDto {
  @ApiProperty({ enum: ['season', 'raid_weekend', 'clan_games', 'cwl'] })
  type: 'season' | 'raid_weekend' | 'clan_games' | 'cwl';

  @ApiProperty({ enum: ['active', 'upcoming'] })
  state: 'active' | 'upcoming';

  startTime: Date;
  endTime: Date;

  /** CWL only: when signup closes. */
  signupEndTime?: Date;
}

export class UpcomingEventsDto {
  /** Running or next occurrence of each event, soonest change first. */
  items: GameEventDto[];
}
