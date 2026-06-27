export enum QueueTypes {
  EXPORT = 'export',
  TASKS = 'tasks',
}

export enum JobTypes {
  EXPORT_MEMBERS = 'export_members',
}

export enum RedisKeys {
  USER_BLOCKED = 'user_blocked',
  HANDOFF_TOKEN = 'handoff_token',

  // Tracking worker loop timings (apps/worker)
  LOOP_TIMINGS = 'loop_timings',
  CLAN_LOOP = 'clan_loop',
  WAR_LOOP = 'war_loop',
  PLAYER_LOOP = 'player_loop',
  CAPITAL_RAID_LOOP = 'capital_raid_loop',
  RANKING_LOOP = 'ranking_loop',
}

export enum RedisChannels {
  UPSTREAM_FEED = 'upstream_feed',
  CONNECT = 'connect',
  CLAN_ADDED = 'clan_added',
  CLAN_REMOVED = 'clan_removed',
}
