export const Config = {
  IS_PROD: process.env.NODE_ENV === 'production',
  ALLOWED_DOMAINS: [
    'https://clashperk.com',
    'https://api.clashperk.com',
    'https://app.clashperk.com',
    'https://dash.clashperk.com',
    'https://docs.clashperk.com',
    'https://staging.clashperk.com',
    'https://dashboard.clashperk.com',
  ] as const,
  CRON_ENABLED: process.env.CRONJOB_ENABLED === '1',
};

export const SNOWFLAKE_REGEX = /^\d{17,19}/;

export const TAG_REGEX = /^#?[0289CGJLOPQRUVY]+$/i;

export const LEGEND_LEAGUE_ID = 105000036;

export const UNRANKED_TIER_ID = 105000000;

/** Alias of {@link UNRANKED_TIER_ID} used by the tracking worker (apps/worker). */
export const UNRANKED_TIER = UNRANKED_TIER_ID;

/** Equivalent to {@link Config.IS_PROD}; used by apps/worker. */
export const PRODUCTION_MODE = process.env.NODE_ENV === 'production';

/** Internal event-emitter keys for the tracking worker (apps/worker). */
export enum WorkerEvents {
  WORKER_STARTED = 'worker_started',
  CLANS_LOADED = 'clans_loaded',
  CLAN_ADDED = 'clan_added',
  CLAN_REMOVED = 'clan_removed',
  START_POLLING = 'start_polling',

  CLAN_UPSTREAM = 'clan_upstream',
  PLAYER_UPSTREAM = 'player_upstream',
  WAR_UPSTREAM = 'war_upstream',
  CAPITAL_UPSTREAM = 'capital_upstream',

  JOIN_LEAVE_DETECTED = 'join_leave_detected',
  CLAN_UPDATE_DETECTED = 'clan_update_detected',
  CLAN_MEMBER_UPDATE_DETECTED = 'clan_member_update_detected',
  WAR_PREF_CHANGE_DETECTED = 'war_pref_change_detected',
}

export const RolePositions: { [key: string]: number } = {
  member: 1,
  admin: 2,
  coLeader: 3,
  leader: 4,
};

/** Log/feature bitfield flags. These op-codes are part of the upstream payload contract consumed by the bot — do not change the values. */
export enum Flags {
  DONATION_LOG = 1 << 0,
  CLAN_FEED_LOG = 1 << 1,
  LAST_SEEN_LOG = 1 << 2,
  CLAN_EMBED_LOG = 1 << 3,
  CLAN_GAMES_LOG = 1 << 4,
  CLAN_WAR_LOG = 1 << 5,
  CHANNEL_LINKED = 1 << 6,
  SERVER_LINKED = 1 << 7,
  LEGEND_LOG = 1 << 8,
  TOWN_HALL_LOG = 1 << 9,
  PLAYER_FEED_LOG = 1 << 10,
  JOIN_LEAVE_LOG = 1 << 11,
  CAPITAL_LOG = 1 << 12,
  CLAN_EVENT_LOG = 1 << 13,
  DONATION_LOG_V2 = 1 << 14,
}

export enum LogType {
  DONATION_LOG = 'DONATION_LOG',
  JOIN_LEAVE_LOG = 'JOIN_LEAVE_LOG',
  ROLE_CHANGE_LOG = 'ROLE_CHANGE_LOG',
  TOWN_HALL_UPGRADE_LOG = 'TOWN_HALL_UPGRADE_LOG',
  NAME_CHANGE_LOG = 'NAME_CHANGE_LOG',
}
