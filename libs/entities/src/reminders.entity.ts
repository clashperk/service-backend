import { ObjectId } from 'mongodb';

export interface CapitalRaidRemindersEntity {
  guild: string;
  channel: string;
  message: string;
  duration: number;
  allMembers: boolean;
  minThreshold: number;
  webhook?: { id: string; token: string } | null;
  threadId?: string;
  linkedOnly?: boolean;
  roles: string[];
  clans: string[];
  remaining: number[];
  createdAt: Date;
}

export interface CapitalRaidSchedulesEntity {
  guild: string;
  name: string;
  tag: string;
  duration: number;
  source?: string;
  reminderId: ObjectId;
  triggered: boolean;
  timestamp: Date;
  createdAt: Date;
}

export interface ClanGamesRemindersEntity {
  guild: string;
  channel: string;
  message: string;
  duration: number;
  allMembers: boolean;
  webhook?: { id: string; token: string } | null;
  threadId?: string;
  minPoints: number;
  linkedOnly?: boolean;
  roles: string[];
  clans: string[];
  createdAt: Date;
}

export interface ClanGamesSchedulesEntity {
  guild: string;
  name: string;
  tag: string;
  duration: number;
  source?: string;
  reminderId: ObjectId;
  triggered: boolean;
  timestamp: Date;
  createdAt: Date;
}

export interface ClanWarSchedulesEntity {
  guild: string;
  name: string;
  tag: string;
  warTag?: string;
  duration: number;
  source?: string;
  reminderId: ObjectId;
  isFriendly: boolean;
  triggered: boolean;
  timestamp: Date;
  createdAt: Date;
}

export interface ClanWarRemindersEntity {
  guild: string;
  channel: string;
  message: string;
  duration: number;
  webhook?: { id: string; token: string } | null;
  threadId?: string;
  roles: string[];
  townHalls: number[];
  linkedOnly?: boolean;
  smartSkip: boolean;
  warTypes: string[];
  clans: string[];
  remaining: number[];
  createdAt: Date;
}
