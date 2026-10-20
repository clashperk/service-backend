import { ObjectId } from 'mongodb';

/** A server that gets beta features: hidden bot commands and beta dashboard pages. */
export class BetaGuildsEntity {
  _id: ObjectId;
  guildId: string;
  note: string | null;
  /** Discord ID of the admin who added it. */
  addedBy: string;
  createdAt: Date;
}
