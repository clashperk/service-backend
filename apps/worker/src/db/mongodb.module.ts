import { Global, Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import {
  CapitalContributionEntity,
  CapitalRaidSeasonEntity,
  ClanCategoriesEntity,
  ClanGamesEntity,
  ClanStoresEntity,
  ClanWarsEntity,
  CWLGroupsEntity,
  GlobalClanEntity,
  GlobalClanHistoryEntity,
  GlobalPlayerEntity,
  LegendAttacksEntity,
  PlayerLinksEntity,
  PlayerSeasonEntity,
  PlayersEntity,
} from './collections';

export enum Collections {
  CLAN_STORES = 'ClanStores',
  CLAN_CATEGORIES = 'ClanCategories',

  PORTAL_USERS = 'PortalUsers',
  PLAYER_LINKS = 'PlayerLinks',
  CLAN_WARS = 'ClanWars',
  CWL_GROUPS = 'CWLGroups',
  LEGEND_ATTACKS = 'LegendAttacks',

  PLAYERS = 'Players',

  DONATION_LOGS = 'DonationLogs',
  LAST_SEEN_LOGS = 'LastSeenLogs',
  CLAN_GAMES_LOGS = 'ClanGamesLogs',
  CLAN_EMBED_LOGS = 'ClanEmbedLogs',
  CLAN_FEED_LOGS = 'ClanFeedLogs',
  CLAN_WAR_LOGS = 'ClanWarLogs',
  RAID_REMINDERS = 'RaidReminders',
  RAID_SCHEDULERS = 'RaidSchedulers',

  EVENT_LOGS = 'EventLogs',
  CLAN_LOGS = 'ClanLogs',

  FLAGS = 'Flags',

  LINKED_CLANS = 'LinkedClans',
  LINKED_PLAYERS = 'LinkedPlayers',
  LINKED_CHANNELS = 'LinkedChannels',
  TIME_ZONES = 'TimeZones',
  REMINDERS = 'Reminders',
  SCHEDULERS = 'Schedulers',

  PATRONS = 'Patrons',
  SETTINGS = 'Settings',
  PLAYER_ACTIVITIES = 'PlayerActivities',
  CLAN_GAMES = 'ClanGames',
  CWL_WAR_TAGS = 'CWLWarTags',
  CLAN_MEMBERS = 'ClanMembers',
  PLAYER_SEASONS = 'PlayerSeasons',
  CAPITAL_CONTRIBUTIONS = 'CapitalContributions',
  CAPITAL_RAID_SEASONS = 'CapitalRaidSeasons',
  CLAN_GAMES_POINTS = 'ClanGamesPoints',

  CLANS = 'Clans',
  WARS = 'Wars',

  PLAYER_RANKS = 'PlayerRanks',
  CAPITAL_RANKS = 'CapitalRanks',
  CLAN_RANKS = 'ClanRanks',

  GLOBAL_CLANS = 'global_clans',
  GLOBAL_PLAYERS = 'global_players',
  GLOBAL_CLAN_HISTORY = 'global_clan_history',
}

interface CollectionRecords {
  [Collections.CLAN_STORES]: ClanStoresEntity;
  [Collections.CLAN_CATEGORIES]: ClanCategoriesEntity;
  [Collections.PLAYER_LINKS]: PlayerLinksEntity;
  [Collections.CLAN_WARS]: ClanWarsEntity;
  [Collections.PLAYERS]: PlayersEntity;

  [Collections.LEGEND_ATTACKS]: LegendAttacksEntity;
  [Collections.CWL_GROUPS]: CWLGroupsEntity;

  [Collections.GLOBAL_CLANS]: GlobalClanEntity;
  [Collections.GLOBAL_PLAYERS]: GlobalPlayerEntity;
  [Collections.GLOBAL_CLAN_HISTORY]: GlobalClanHistoryEntity;

  [Collections.CLAN_GAMES_POINTS]: ClanGamesEntity;
  [Collections.CAPITAL_CONTRIBUTIONS]: CapitalContributionEntity;
  [Collections.PLAYER_SEASONS]: PlayerSeasonEntity;
  [Collections.CAPITAL_RAID_SEASONS]: CapitalRaidSeasonEntity;
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
    @Inject(MONGODB_TOKEN) private mainDb: Db,
    @Inject(GLOBAL_MONGODB_TOKEN) private globalDb: Db,
  ) {}

  onModuleInit() {
    this.mainDb.command({ ping: 1 }); // eslint-disable-line
    this.globalDb.command({ ping: 1 }); // eslint-disable-line
  }
}
