import { ObjectId } from 'mongodb';

export class FlagAlertLogsEntity {
  _id: ObjectId;
  guildId: string;
  channelId: string;
  /** Pinged when a flagged player joins; ignored when `useAutoRole` is on. */
  roleId: string | null;
  /** Pings each clan's leader and co-leader roles from auto-roles instead. */
  useAutoRole: boolean;
  /** Unset until the bot first posts in the channel. */
  webhook?: { id: string; token: string } | null;
  createdAt: Date;
  updatedAt: Date;
}
