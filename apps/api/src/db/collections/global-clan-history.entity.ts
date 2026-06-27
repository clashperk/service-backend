import { ObjectId } from 'mongodb';

export class ClanHistoryEntity {
  playerTag: string;
  firstSeen: Date;
  lastSeen: Date;
}

export class GlobalClanEntity {
  tag: string;
  name: string;
}

export class GlobalPlayerEntity {
  name: string;
  tag: string;
  trackingId: ObjectId;
}

export class GlobalClanHistoryEntity extends ClanHistoryEntity {
  clan: GlobalClanEntity;
}
