import { ObjectId } from 'mongodb';

/** The bot's clan log record: one per clan, log type and server. */
export interface ClanLogsEntity {
  _id: ObjectId;
  guildId: string;
  clanTag: string;
  /** The clan's `ClanStores` record for this server. */
  clanId: ObjectId;
  logType: string;
  isEnabled: boolean;
  channelId: string;
  deepLink: string;
  roleId?: string;
  webhook: { id: string; token: string } | null;
  /** The self-updating message, for logs that edit one message. */
  messageId: string | null;
  color: number | null;
  lastPostedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

/** The bot's Patreon record; an active one lifts the server's limits. */
export interface PatronsEntity {
  _id: ObjectId;
  active: boolean;
  guilds: { id: string; limit: number }[];
}
