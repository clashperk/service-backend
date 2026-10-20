import { ObjectId } from 'mongodb';

export class FlagsEntity {
  _id: ObjectId;
  guild: string;
  /** Discord ID of the member who added the flag. */
  user: string;
  flagType: 'ban' | 'strike';
  flagImpact: number;
  username: string;
  displayName: string;
  discriminator: string;
  tag: string;
  name: string;
  reason: string;
  expiresAt: Date | null;
  createdAt: Date;
}
