import { ApiProperty } from '@nestjs/swagger';

export class ReminderClanDto {
  tag: string;
  name: string;
}

export class ReminderScheduleDto {
  id: string;
  clan: ReminderClanDto;
  /** When the bot pings (or pinged) for this clan. */
  timestamp: Date;
  triggered: boolean;
  /** Bot outcome once handled, e.g. `reminder_sent_successfully` or a skip reason. */
  reason: string | null;
  @ApiProperty({ enum: ['normal', 'friendly', 'cwl'], nullable: true })
  warType: 'normal' | 'friendly' | 'cwl' | null;
}

export class ReminderBaseDto {
  id: string;
  /** Short ID the bot shows in Discord: the last 5 hex characters, uppercased. */
  shortId: string;
  channelId: string;
  channelName: string | null;
  threadId: string | null;
  message: string;
  /** Time before the event ends, in milliseconds. */
  duration: number;
  roles: string[];
  linkedOnly: boolean;
  clans: ReminderClanDto[];
  /** Runs from the last 3 days and upcoming ones, oldest first. The bot drops older runs. */
  schedules: ReminderScheduleDto[];
  createdAt: Date;
}

export class ClanWarReminderDto extends ReminderBaseDto {
  disabled: boolean;
  townHalls: number[];
  remaining: number[];
  warTypes: string[];
  smartSkip: boolean;
  silent: boolean;
  randomLimit: number | null;
}

export class CapitalRaidReminderDto extends ReminderBaseDto {
  allMembers: boolean;
  minThreshold: number;
  remaining: number[];
}

export class ClanGamesReminderDto extends ReminderBaseDto {
  allMembers: boolean;
  minPoints: number;
}

export class GuildRemindersDto {
  clanWars: ClanWarReminderDto[];
  capitalRaids: CapitalRaidReminderDto[];
  clanGames: ClanGamesReminderDto[];
}
