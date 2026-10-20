import { ObjectId } from 'mongodb';

export interface ClanEmbedMetadata {
  /** Custom text, or "auto" for the in-game clan description. */
  description?: string;
  /** Custom requirement text, or "auto" for the in-game Town Hall requirement. */
  accepts?: string;
  bannerImage?: string | null;
  /** Field keys from `ClanEmbedFields` in the bot; `*` is all of them. */
  fields?: string[];
  rulesText?: string;
}

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
  /** The clan embed's settings, for `clan_embed_log` only. */
  metadata?: ClanEmbedMetadata;
  lastPostedAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

/** The bot's Patreon record; an active one lifts the server's limits. */
export interface PatronsEntity {
  _id: ObjectId;
  active: boolean;
  guilds: { id: string; limit: number }[];
  /** A special tier, e.g. `lifetime` or `gifted`; unset for a regular pledge. */
  note?: string;
}
