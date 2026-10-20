import { Global, Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import {
  ApiUsersEntity,
  CapitalContributionsEntity,
  CapitalRaidSeasonsEntity,
  CapitalRaidRemindersEntity,
  ClanCategoriesEntity,
  ClanGamesPointsEntity,
  ClanGamesRemindersEntity,
  ClanLogsEntity,
  FlagsEntity,
  FlagAlertLogsEntity,
  TicketPanelsEntity,
  TicketSettingsEntity,
  TicketsEntity,
  BetaGuildsEntity,
  ClanStoresEntity,
  ClanWarRemindersEntity,
  ClanWarsEntity,
  CustomBotsEntity,
  CWLGroupsEntity,
  GlobalClanEntity,
  GlobalClanHistoryEntity,
  GlobalPlayerEntity,
  LegendAttacksEntity,
  PatronsEntity,
  PlayerLinksEntity,
  UsersEntity,
  PlayerSeasonsEntity,
  PlayersEntity,
  ReminderSchedulesEntity,
  RosterGroupsEntity,
  RostersEntity,
  SettingsEntity,
} from '@app/collections';

export enum Collections {
  CLAN_STORES = 'ClanStores',
  CLAN_CATEGORIES = 'ClanCategories',
  SETTINGS = 'Settings',
  CUSTOM_BOTS = 'CustomBots',

  BOT_GUILDS = 'BotGuilds',

  PORTAL_USERS = 'PortalUsers',
  USERS = 'Users',
  PLAYER_LINKS = 'PlayerLinks',
  PLAYER_LINK_AUDIT_LOGS = 'PlayerLinkAuditLogs',
  CLAN_WARS = 'ClanWars',
  CWL_GROUPS = 'CWLGroups',
  LEGEND_ATTACKS = 'LegendAttacks',

  PLAYERS = 'Players',
  PLAYER_SEASONS = 'PlayerSeasons',

  GOOGLE_SHEETS = 'GoogleSheets',

  CLAN_GAMES_POINTS = 'ClanGamesPoints',
  CAPITAL_CONTRIBUTIONS = 'CapitalContributions',
  CAPITAL_RAID_SEASONS = 'CapitalRaidSeasons',

  ROSTERS = 'Rosters',
  ROSTER_GROUPS = 'RosterCategories',

  CLAN_WAR_REMINDERS = 'Reminders',
  CAPITAL_RAID_REMINDERS = 'RaidReminders',
  CLAN_GAMES_REMINDERS = 'ClanGamesReminders',
  CLAN_WAR_SCHEDULES = 'Schedulers',
  CAPITAL_RAID_SCHEDULES = 'RaidSchedulers',
  CLAN_GAMES_SCHEDULES = 'ClanGamesSchedulers',
  CLAN_LOGS = 'ClanLogs',
  PATRONS = 'Patrons',
  FLAGS = 'Flags',
  FLAG_ALERT_LOGS = 'FlagAlertLogs',
  TICKET_PANELS = 'TicketPanels',
  TICKET_SETTINGS = 'TicketSettings',
  TICKETS = 'Tickets',
  BETA_GUILDS = 'BetaGuilds',

  GLOBAL_CLANS = 'global_clans',
  GLOBAL_PLAYERS = 'global_players',
  GLOBAL_CLAN_HISTORY = 'global_clan_history',
}

interface CollectionRecords {
  [Collections.CLAN_STORES]: ClanStoresEntity;
  [Collections.CLAN_CATEGORIES]: ClanCategoriesEntity;
  [Collections.SETTINGS]: SettingsEntity;
  [Collections.CUSTOM_BOTS]: CustomBotsEntity;

  [Collections.PORTAL_USERS]: ApiUsersEntity;
  [Collections.USERS]: UsersEntity;
  [Collections.PLAYER_LINKS]: PlayerLinksEntity;
  [Collections.CLAN_WARS]: ClanWarsEntity;
  [Collections.PLAYERS]: PlayersEntity;
  [Collections.PLAYER_SEASONS]: PlayerSeasonsEntity;
  [Collections.CLAN_GAMES_POINTS]: ClanGamesPointsEntity;

  [Collections.GLOBAL_CLANS]: GlobalClanEntity;
  [Collections.GLOBAL_PLAYERS]: GlobalPlayerEntity;
  [Collections.GLOBAL_CLAN_HISTORY]: GlobalClanHistoryEntity;
  [Collections.LEGEND_ATTACKS]: LegendAttacksEntity;
  [Collections.CWL_GROUPS]: CWLGroupsEntity;
  [Collections.CAPITAL_CONTRIBUTIONS]: CapitalContributionsEntity;
  [Collections.CAPITAL_RAID_SEASONS]: CapitalRaidSeasonsEntity;

  [Collections.ROSTERS]: RostersEntity;
  [Collections.ROSTER_GROUPS]: RosterGroupsEntity;

  [Collections.CLAN_WAR_REMINDERS]: ClanWarRemindersEntity;
  [Collections.CAPITAL_RAID_REMINDERS]: CapitalRaidRemindersEntity;
  [Collections.CLAN_GAMES_REMINDERS]: ClanGamesRemindersEntity;
  [Collections.CLAN_WAR_SCHEDULES]: ReminderSchedulesEntity;
  [Collections.CAPITAL_RAID_SCHEDULES]: ReminderSchedulesEntity;
  [Collections.CLAN_GAMES_SCHEDULES]: ReminderSchedulesEntity;
  [Collections.CLAN_LOGS]: ClanLogsEntity;
  [Collections.PATRONS]: PatronsEntity;
  [Collections.FLAGS]: FlagsEntity;
  [Collections.FLAG_ALERT_LOGS]: FlagAlertLogsEntity;
  [Collections.TICKET_PANELS]: TicketPanelsEntity;
  [Collections.TICKET_SETTINGS]: TicketSettingsEntity;
  [Collections.TICKETS]: TicketsEntity;
  [Collections.BETA_GUILDS]: BetaGuildsEntity;
}

declare module 'mongodb' {
  interface Db {
    collection<T extends keyof CollectionRecords>(name: T): Collection<CollectionRecords[T]>;
  }
}

export const MONGODB_TOKEN = 'MONGODB_TOKEN';
export const GLOBAL_MONGODB_TOKEN = 'GLOBAL_MONGODB_TOKEN';

@Global()
@Module({
  providers: [
    {
      provide: MONGODB_TOKEN,
      useFactory: (configService: ConfigService): Db => {
        return new MongoClient(configService.getOrThrow('MONGODB_URL')).db(
          configService.getOrThrow('MONGODB_DATABASE'),
        );
      },
      inject: [ConfigService],
    },
    {
      provide: GLOBAL_MONGODB_TOKEN,
      useFactory: (configService: ConfigService): Db => {
        return new MongoClient(configService.getOrThrow('GLOBAL_MONGODB_URL')).db(
          configService.getOrThrow('GLOBAL_MONGODB_DATABASE'),
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [MONGODB_TOKEN, GLOBAL_MONGODB_TOKEN],
})
export class MongoDbModule {
  constructor(
    @Inject(MONGODB_TOKEN) private primaryDb: Db,
    @Inject(GLOBAL_MONGODB_TOKEN) private globalDb: Db,
  ) {}

  onModuleInit() {
    this.primaryDb.command({ ping: 1 }); // eslint-disable-line
    this.globalDb.command({ ping: 1 }); // eslint-disable-line
  }
}
