export class PlayerActivitiesEntity {
  /**
   * Indexed
   */
  playerTag: string;

  /**
   * Format: 2023-12-12T00:00
   *
   * Compound index with playerTag
   */
  timestamp: string;

  count: number;

  createdAt: Date; // TTL Indexed
}

export class PlayerHistoriesEntity {
  playerTag: string;

  clanTag: string;

  dateLastOut: Date;

  dateFirstIn: Date;
}
