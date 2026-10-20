import { ObjectId } from 'mongodb';

/** The fields of the bot's clan log records the API reads. */
export interface ClanLogsEntity {
  _id: ObjectId;
  guildId: string;
  clanTag: string;
  channelId: string;
  webhook: { id: string; token: string } | null;
}

/** The bot's Patreon record; an active one lifts the server's limits. */
export interface PatronsEntity {
  _id: ObjectId;
  active: boolean;
  guilds: { id: string; limit: number }[];
}
