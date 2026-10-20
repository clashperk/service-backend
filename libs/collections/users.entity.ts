/** The bot's per-user record: their default clan, timezone and last searches. */
export class UsersEntity {
  userId: string;
  username?: string;
  displayName?: string;
  discriminator?: string;
  /** Used by commands run without a clan tag. */
  clan?: { tag: string; name?: string };
  /** Saved on the dashboard; the bot doesn't read it. */
  savedClans?: { tag: string; name: string }[];
  lastSearchedClanTag?: string;
  lastSearchedPlayerTag?: string;
  timezone?: UserTimezone;
  createdAt?: Date;
}

export class UserTimezone {
  /** IANA ID, e.g. `Asia/Kolkata`. */
  id: string;
  name: string;
  /** Seconds from UTC when it was saved. */
  offset: number;
  location: string;
}
