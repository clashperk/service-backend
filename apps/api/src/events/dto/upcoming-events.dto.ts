import { DateTime } from '@app/decorators';
import { ApiProperty } from '@nestjs/swagger';

export class GameEventDto {
  @ApiProperty({ enum: ['season', 'raid_weekend', 'clan_games', 'cwl'] })
  type: 'season' | 'raid_weekend' | 'clan_games' | 'cwl';

  @ApiProperty({ enum: ['ended', 'active', 'upcoming'] })
  state: 'ended' | 'active' | 'upcoming';

  startTime: Date;
  endTime: Date;

  /** CWL only: when signup closes. */
  signupEndTime?: Date;
}

export class UpcomingEventsDto {
  /** Running or next occurrence of each event, soonest change first. */
  items: GameEventDto[];
}

export class GameEventsInputDto {
  /** Events that end after this. */
  @DateTime()
  from: number;

  /** Events that start before this; at most 100 days after `from`. */
  @DateTime()
  to: number;
}

export class GameEventsDto {
  /** Every occurrence overlapping the range, by start time. */
  items: GameEventDto[];
}
