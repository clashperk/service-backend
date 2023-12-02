export enum Tokens {
  MONGODB = 'MONGODB',
  REDIS = 'REDIS',
  REDIS_PUB = 'REDIS_PUB',
  REDIS_SUB = 'REDIS_SUB',
  ELASTIC = 'ELASTIC',
  REST = 'REST',
}

export enum TokenType {
  ACCESS_TOKEN = 'access_token',
}

// TODO: Some names don't make any sense. Let's change them later.
export enum RedisKeyPrefixes {
  CAPITAL_RAID_SEASON = 'CRS',
  CAPITAL_REMINDER_CURSOR = 'CR-',
  CAPITAL_RAID_MEMBER = 'CRM',
  CLAN = 'C',
  PLAYER = 'P',
}

export enum Collections {
  CLAN_STORES = 'ClanStores',
  DONATION_LOGS = 'DonationLogs',
  LAST_SEEN_LOGS = 'LastSeenLogs',
  CLAN_GAMES_LOGS = 'ClanGamesLogs',
  CLAN_EMBED_LOGS = 'ClanEmbedLogs',
  CLAN_FEED_LOGS = 'ClanFeedLogs',
  CLAN_WAR_LOGS = 'ClanWarLogs',
  RAID_REMINDERS = 'RaidReminders',
  RAID_SCHEDULERS = 'RaidSchedulers',

  EVENT_LOGS = 'EventLogs',

  LEGEND_ATTACKS = 'LegendAttacks',

  FLAGS = 'Flags',

  LINKED_CLANS = 'LinkedClans',
  LINKED_PLAYERS = 'LinkedPlayers',
  LINKED_CHANNELS = 'LinkedChannels',
  TIME_ZONES = 'TimeZones',
  REMINDERS = 'Reminders',
  SCHEDULERS = 'Schedulers',

  PATRONS = 'Patrons',
  SETTINGS = 'Settings',
  LAST_SEEN = 'LastSeen',
  CLAN_WARS = 'ClanWars',
  CLAN_GAMES = 'ClanGames',
  CWL_WAR_TAGS = 'CWLWarTags',
  CWL_GROUPS = 'CWLGroups',
  CLAN_MEMBERS = 'ClanMembers',
  PLAYER_SEASONS = 'PlayerSeasons',
  CAPITAL_CONTRIBUTIONS = 'CapitalContributions',
  CAPITAL_RAID_SEASONS = 'CapitalRaidSeasons',
  CLAN_GAMES_POINTS = 'ClanGamesPoints',

  PLAYERS = 'Players',
  CLANS = 'Clans',
  WARS = 'Wars',

  PLAYER_RANKS = 'PlayerRanks',
  CAPITAL_RANKS = 'CapitalRanks',
  CLAN_RANKS = 'ClanRanks',

  BOT_GROWTH = 'BotGrowth',
  BOT_USAGE = 'BotUsage',
  BOT_GUILDS = 'BotGuilds',
  BOT_USERS = 'BotUsers',
  BOT_STATS = 'BotStats',
  BOT_INTERACTIONS = 'BotInteractions',
}
