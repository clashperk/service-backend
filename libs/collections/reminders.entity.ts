import { ObjectId } from 'mongodb';

interface ReminderBaseEntity {
  _id: ObjectId;
  guild: string;
  channel: string;
  message: string;
  duration: number;
  webhook?: { id: string; token: string } | null;
  threadId?: string;
  linkedOnly?: boolean;
  roles: string[];
  clans: string[];
  createdAt: Date;
}

export interface ClanWarRemindersEntity extends ReminderBaseEntity {
  disabled: boolean;
  randomLimit?: number | null;
  townHalls: number[];
  smartSkip: boolean;
  silent: boolean;
  warTypes: string[];
  remaining: number[];
}

export interface CapitalRaidRemindersEntity extends ReminderBaseEntity {
  allMembers: boolean;
  minThreshold: number;
  remaining: number[];
}

export interface ClanGamesRemindersEntity extends ReminderBaseEntity {
  allMembers: boolean;
  minPoints: number;
}
