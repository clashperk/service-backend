export enum Tokens {
  MONGODB = 'MONGODB',
  REDIS = 'REDIS',
  KAFKA = 'KAFKA',
  REDIS_PUB = 'REDIS_PUB',
  REDIS_SUB = 'REDIS_SUB',
  ELASTIC = 'ELASTIC',
  CLASH_CLIENT = 'CLASH_CLIENT',
}

export enum TokenType {
  ACCESS_TOKEN = 'access_token',
}

export enum RedisKeyPrefixes {
  CAPITAL_RAID_SEASON = 'RAID_SEASON',
  CAPITAL_REMINDER_CURSOR = 'RAID_WEEK',
  CAPITAL_RAID_MEMBER = 'RAID_MEMBER',
  CLAN = 'CLAN',
  PLAYER = 'PLAYER',
}

export enum Collections {
  CLAN_STORES = 'ClanStores',
  DONATION_LOGS = 'DonationLogs',
  LAST_SEEN_LOGS = 'LastSeenLogs',
  CLAN_GAMES_LOGS = 'ClanGamesLogs',
  CLAN_EMBED_LOGS = 'ClanEmbedLogs',
  CLAN_FEED_LOGS = 'ClanFeedLogs',
  JOIN_LEAVE_LOGS = 'JoinLeaveLogs',
  CLAN_WAR_LOGS = 'ClanWarLogs',
  LEGEND_LOGS = 'LegendLogs',
  LEGEND_ATTACKS = 'LegendAttacks',

  CAPITAL_LOGS = 'CapitalLogs',

  EVENT_LOGS = 'EventLogs',

  FLAGS = 'Flags',

  PLAYER_LINKS = 'PlayerLinks',
  USERS = 'Users',

  REMINDERS = 'Reminders',
  SCHEDULERS = 'Schedulers',
  RAID_REMINDERS = 'RaidReminders',
  CG_REMINDERS = 'ClanGamesReminders',
  CG_SCHEDULERS = 'ClanGamesSchedulers',
  RAID_SCHEDULERS = 'RaidSchedulers',

  WAR_BASE_CALLS = 'WarBaseCalls',

  PATRONS = 'Patrons',
  SETTINGS = 'Settings',
  LAST_SEEN = 'LastSeen',
  CLAN_WARS = 'ClanWars',
  CLAN_GAMES = 'ClanGames',
  CWL_GROUPS = 'CWLGroups',

  PLAYER_RANKS = 'PlayerRanks',
  CAPITAL_RANKS = 'CapitalRanks',
  CLAN_RANKS = 'ClanRanks',
  CLAN_CATEGORIES = 'ClanCategories',

  GUILD_EVENTS = 'GuildEvents',

  CUSTOM_BOTS = 'CustomBots',

  ROSTERS = 'Rosters',
  ROSTER_CATEGORIES = 'RosterCategories',

  CLAN_MEMBERS = 'ClanMembers',
  CLAN_GAMES_POINTS = 'ClanGamesPoints',
  PLAYER_SEASONS = 'PlayerSeasons',
  CAPITAL_CONTRIBUTIONS = 'CapitalContributions',
  CAPITAL_RAID_SEASONS = 'CapitalRaidSeasons',

  PORTAL_USERS = 'PortalUsers',

  BOT_GROWTH = 'BotGrowth',
  BOT_USAGE = 'BotUsage',
  BOT_GUILDS = 'BotGuilds',
  BOT_USERS = 'BotUsers',
  BOT_STATS = 'BotStats',
  BOT_COMMANDS = 'BotCommands',
  BOT_INTERACTIONS = 'BotInteractions',
}
