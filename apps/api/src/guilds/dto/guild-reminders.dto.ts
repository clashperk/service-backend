export class ReminderClanDto {
  tag: string;
  name: string;
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
