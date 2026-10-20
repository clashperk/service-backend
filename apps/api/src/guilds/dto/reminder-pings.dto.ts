import { IsIn, Matches, ValidateIf } from 'class-validator';

export const PING_MODES = ['optIn', 'optOut'] as const;
export type PingMode = (typeof PING_MODES)[number];

/** A reminder type without a role pings everyone it lists. */
export class ReminderPingsInput {
  /** optIn pings only members with the role; optOut skips them. */
  @IsIn(PING_MODES)
  mode: PingMode;

  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{17,20}$/)
  clanWarsRole: string | null;

  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{17,20}$/)
  capitalRaidsRole: string | null;

  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{17,20}$/)
  clanGamesRole: string | null;
}

export class ReminderPingsDto extends ReminderPingsInput {}
