export enum Tokens {
  MONGODB = 'MONGODB',
  REDIS = 'REDIS',
  ELASTIC = 'ELASTIC',
}

export enum Collections {
  // LOG_CHANNELS
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

  // FLAGS
  FLAGS = 'Flags',

  // LINKED_DATA
  LINKED_CLANS = 'LinkedClans',
  LINKED_PLAYERS = 'LinkedPlayers',
  LINKED_CHANNELS = 'LinkedChannels',
  TIME_ZONES = 'TimeZones',
  REMINDERS = 'Reminders',
  SCHEDULERS = 'Schedulers',

  // LARGE_DATA
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

  // BOT_STATS
  BOT_GROWTH = 'BotGrowth',
  BOT_USAGE = 'BotUsage',
  BOT_GUILDS = 'BotGuilds',
  BOT_USERS = 'BotUsers',
  BOT_STATS = 'BotStats',
  BOT_INTERACTIONS = 'BotInteractions',
}
