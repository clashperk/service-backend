import { ClashClient, ClashClientService, Season } from '@app/clash-client';
import {
  ACHIEVEMENTS_ENUM,
  Flags,
  LEGEND_LEAGUE_ID,
  RAW_UNITS_MAP,
  RedisChannels,
  RedisKeys,
  UNITS_MAP_BY_ID,
  WorkerEvents,
} from '@app/constants';
import { formatDuration, transformAPIPlayer } from '@app/helpers';
import { APIPlayerTransformed, PartialMember } from '@app/helpers/types';
import { Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APIClan, APIPlayer } from 'clashofclans.js';
import Redis from 'ioredis';
import chunk from 'lodash/chunk';
import { AnyBulkWriteOperation, Db, InsertOneModel, UpdateFilter, UpdateOneModel } from 'mongodb';
import { CapitalContributionEntity, ClanGamesEntity, PlayerSeasonEntity } from '../db';
import { Elastic, ELASTIC_TOKEN } from '../db/elastic.module';
import { Collections, MONGODB_TOKEN } from '../db/mongodb.module';
import { REDIS_PUB_TOKEN, REDIS_TOKEN } from '../db/redis.module';
import { RedisService } from '../db/redis.service';
import { BulkWriterService } from '../tasks/bulk-writer.service';
import { WorkerInitDto } from '../util/dto/worker.dto';
import { Emitter } from '../util/emitter';
import { WorkerService } from '../worker.service';

interface Cache {
  tag: string;
}

const CLAN_GAMES_STARTING_DATE = 22;

export class PlayersService {
  private logger = new Logger(PlayersService.name);
  private cached: Map<string, Cache> = new Map();
  private refreshInterval = 5 * 60 * 1000;
  private bulkSize = 4;
  private clashClient: ClashClient;

  public constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(REDIS_PUB_TOKEN) private publisher: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    @Inject(ELASTIC_TOKEN) private elastic: Elastic,
    private workerService: WorkerService,
    private redisService: RedisService,
    private eventEmitter: Emitter,
    private bulkWriter: BulkWriterService,
    private clashClientService: ClashClientService,
  ) {
    this.clashClient = this.clashClientService.getClient();
  }

  @OnEvent(WorkerEvents.WAR_PREF_CHANGE_DETECTED)
  onWarPrefUpdate(players: { name: string; tag: string; clanTag: string; value: 'in' | 'out' }[]) {
    this.bulkWriter.activities.push(
      ...players.map((player) => ({
        tag: player.tag,
        timestamp: Math.floor(Date.now() / 1000),
        clanTag: player.clanTag,
        action: player.value === 'in' ? ('OPTED_IN' as const) : ('OPTED_OUT' as const),
      })),
    );
  }

  @OnEvent(WorkerEvents.CLAN_MEMBER_UPDATE_DETECTED)
  async onClanMemberUpdate(players: any[]) {
    const operations = players.flatMap((player) => [
      { index: { _index: 'clan_member_event_logs' } },
      player,
    ]);
    await this.elastic.bulk({ refresh: false, operations });
  }

  @OnEvent(WorkerEvents.JOIN_LEAVE_DETECTED)
  public onJoinLeave(clan: APIClan, members: PartialMember[]) {
    if (!members.length) return;
    setTimeout(this.exec.bind(this), 1 * 60 * 1000, clan, members, true);
  }

  public async exec(clan: APIClan, members: PartialMember[] = [], scheduled = false) {
    const seasonOperations: AnyBulkWriteOperation<PlayerSeasonEntity>[] = [];
    const contributionOperations: AnyBulkWriteOperation<CapitalContributionEntity>[] = [];
    const clanGamesOperations: AnyBulkWriteOperation<ClanGamesEntity>[] = [];

    const players = await Promise.all(members.map((mem) => this.clashClient.getPlayer(mem.tag)));

    for (const member of members) {
      const player = players.find(({ res, body }) => res.ok && body.tag === member.tag)?.body;
      if (!player) continue;

      const operation = await this._fetchMembers(player, clan);
      if (operation.seasonOps.length) {
        seasonOperations.push(...operation.seasonOps);
      }
      if (operation.clanGamesOps.length) {
        clanGamesOperations.push(...operation.clanGamesOps);
      }
      if (operation.capitalContributionOps.length) {
        contributionOperations.push(...operation.capitalContributionOps);
      }
    }

    await Promise.all([
      seasonOperations.length &&
        this.db
          .collection(Collections.PLAYER_SEASONS)
          .bulkWrite(seasonOperations, { ordered: false }),

      clanGamesOperations.length &&
        this.db
          .collection(Collections.CLAN_GAMES_POINTS)
          .bulkWrite(clanGamesOperations, { ordered: false }),

      contributionOperations.length &&
        this.db
          .collection(Collections.CAPITAL_CONTRIBUTIONS)
          .bulkWrite(contributionOperations, { ordered: false }),

      !scheduled &&
        this.db
          .collection(Collections.CLAN_STORES)
          .updateMany({ tag: clan.tag }, { $set: { lastRan: new Date() } }),
    ]);
  }

  private getUnitType(unitId: string) {
    const unit = RAW_UNITS_MAP[UNITS_MAP_BY_ID[unitId]];
    return unit?.subCategory.toUpperCase() || 'TROOP';
  }

  private async activity(player: APIPlayer, payload: APIPlayerTransformed) {
    const cached = (await this.redisService.getPlayer(
      player.tag,
    )) as unknown as APIPlayerTransformed | null;

    if (cached && cached.monthId === payload.monthId) {
      payload.initialClanGamesPoints = cached.initialClanGamesPoints;
    } else {
      payload.initialClanGamesPoints = payload.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS];
    }

    if (cached && (player.builderBaseTrophies ?? 0) > (cached.builderBaseTrophies ?? 0)) {
      cached.builderBattleWins ??= 0;
      cached.builderBattleWins += 1;
    }

    if (cached) {
      for (const unit of Object.keys(payload.units)) {
        if (!cached.units[unit]) {
          this.bulkWriter.playerProgress.push({
            name: payload.name,
            tag: payload.tag,
            unit: unit,
            type: this.getUnitType(unit),
            value: payload.units[unit],
            action: 'UNLOCK',
            createdAt: Math.floor(Date.now() / 1000),
          });
        } else if (payload.units[unit] > cached.units[unit]) {
          this.bulkWriter.playerProgress.push({
            name: payload.name,
            tag: payload.tag,
            unit: unit,
            type: this.getUnitType(unit),
            value: payload.units[unit],
            action: 'UPGRADE',
            createdAt: Math.floor(Date.now() / 1000),
          });
        }
      }
      for (const unit of Object.keys(payload.superTroops)) {
        if (
          typeof cached.superTroops[unit] !== 'number' ||
          payload.superTroops[unit] > cached.superTroops[unit]
        ) {
          this.bulkWriter.playerProgress.push({
            name: payload.name,
            tag: payload.tag,
            unit: unit,
            value: payload.units[unit],
            type: this.getUnitType(unit),
            action: 'BOOST',
            createdAt: Math.floor(Date.now() / 1000),
          });
        }
      }
    }

    if (
      cached &&
      payload.trophies !== 0 &&
      payload.trophies > cached.trophies &&
      payload.leagueId !== LEGEND_LEAGUE_ID
    ) {
      const diff = payload.trophies - cached.trophies;
      this.bulkWriter.trophyChanges.push({
        name: payload.name,
        tag: payload.tag,
        createdAt: Math.floor(Date.now() / 1000),
        leagueId: payload.leagueId,
        trophies: payload.trophies,
        diff,
        weekId: Season.tournamentID,
        attacks: payload.attackWins,
        defenses: payload.defenseWins,
      });
    }

    if (cached && cached.ex > Date.now()) {
      if (
        this.didAchievementChange(payload, cached, true) ||
        payload.attackWins > cached.attackWins ||
        payload.donations > cached.donations ||
        payload.warPreference !== cached.warPreference ||
        payload.builderBaseTrophies !== cached.builderBaseTrophies ||
        payload.name !== cached.name ||
        (payload.trophies >= 5000 && payload.trophies > cached.trophies)
      ) {
        this.bulkWriter.activities.push({
          tag: player.tag,
          timestamp: Math.floor(Date.now() / 1000),
          clanTag: player.clan?.tag ?? '#00000',
          action: 'UNKNOWN',
        });

        await this.db.collection(Collections.PLAYERS).updateOne(
          { tag: payload.tag },
          {
            $set: {
              name: payload.name,
              leagueId: payload.leagueId,
              townHallLevel: payload.townHallLevel,
              trophies: payload.trophies,
              ...(player.clan && { clan: { name: player.clan.name, tag: player.clan.tag } }),
              lastSeen: new Date(),
            },
            $inc: { [`seasons.${payload.seasonId}`]: 1 },
          },
        );
      }
    }

    if (cached && cached.townHallLevel !== payload.townHallLevel && player.clan) {
      this.eventEmitter.emit(WorkerEvents.PLAYER_UPSTREAM, {
        tag: player.clan.tag,
        op: Flags.TOWN_HALL_LOG,
        members: [
          {
            name: player.name,
            tag: player.tag,
            townHallLevel: cached.townHallLevel,
            op: 'TOWN_HALL_UPGRADE',
          },
        ],
        clan: {
          name: player.clan.name,
          tag: player.clan.tag,
          badge: player.clan.badgeUrls.small,
          badgeUrl: player.clan.badgeUrls.small,
        },
      });

      this.eventEmitter.emit(WorkerEvents.CLAN_MEMBER_UPDATE_DETECTED, [
        {
          name: player.name,
          tag: player.tag,
          clan_name: player.clan.name,
          clan_tag: player.clan.tag,
          op: 'TOWN_HALL_UPGRADE',
          value: payload.townHallLevel,
          created_at: new Date(),
        },
      ]);
    }

    if (cached && cached.warPreference !== payload.warPreference && player.clan && cached.clan) {
      this.eventEmitter.emit(WorkerEvents.PLAYER_UPSTREAM, {
        tag: player.clan.tag,
        op: Flags.PLAYER_FEED_LOG,
        members: [
          {
            name: player.name,
            tag: player.tag,
            warPreference: payload.warPreference,
            townHallLevel: cached.townHallLevel,
            op: 'WAR_PREF_CHANGE',
          },
        ],
        clan: {
          name: player.clan.name,
          tag: player.clan.tag,
          badge: player.clan.badgeUrls.small,
          badgeUrl: player.clan.badgeUrls.small,
        },
      });

      this.eventEmitter.emit(WorkerEvents.WAR_PREF_CHANGE_DETECTED, [
        {
          tag: player.tag,
          clanTag: player.clan.tag,
          op: 'WAR_PREF_CHANGE',
          value: payload.warPreference,
        },
      ]);
    }

    if (
      cached &&
      cached.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] !==
        payload.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] &&
      player.clan
    ) {
      this.eventEmitter.emit(WorkerEvents.PLAYER_UPSTREAM, {
        tag: player.clan.tag,
        op: Flags.CAPITAL_LOG,
        members: [
          {
            name: player.name,
            tag: player.tag,
            contributed:
              payload.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] -
              cached.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION],
            townHallLevel: cached.townHallLevel,
            op: 'CAPITAL_GOLD_CONTRIBUTION',
          },
        ],
        clan: {
          name: player.clan.name,
          tag: player.clan.tag,
          badge: player.clan.badgeUrls.small,
          badgeUrl: player.clan.badgeUrls.small,
        },
      });
    }

    await this.redisService.setPlayer(payload);
    return cached;
  }

  private didAchievementChange(
    player: APIPlayerTransformed,
    cached: APIPlayerTransformed,
    forLastSeen: boolean,
  ) {
    return (
      player.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] >
        cached.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] ||
      player.achievements[ACHIEVEMENTS_ENUM.CLAN_CAPITAL_RAIDS] >
        cached.achievements[ACHIEVEMENTS_ENUM.CLAN_CAPITAL_RAIDS] ||
      player.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] >
        cached.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] ||
      player.achievements[ACHIEVEMENTS_ENUM.DARK_ELIXIR_LOOTS] >
        cached.achievements[ACHIEVEMENTS_ENUM.DARK_ELIXIR_LOOTS] ||
      player.achievements[ACHIEVEMENTS_ENUM.ELIXIR_LOOTS] >
        cached.achievements[ACHIEVEMENTS_ENUM.ELIXIR_LOOTS] ||
      player.achievements[ACHIEVEMENTS_ENUM.GOLD_LOOTS] >
        cached.achievements[ACHIEVEMENTS_ENUM.GOLD_LOOTS] ||
      player.achievements[ACHIEVEMENTS_ENUM.SEASON_CHALLENGE_POINTS] >
        cached.achievements[ACHIEVEMENTS_ENUM.SEASON_CHALLENGE_POINTS] ||
      player.achievements[ACHIEVEMENTS_ENUM.UNION_BUSTER] >
        cached.achievements[ACHIEVEMENTS_ENUM.UNION_BUSTER] ||
      player.achievements[ACHIEVEMENTS_ENUM.WALL_BUSTER] >
        cached.achievements[ACHIEVEMENTS_ENUM.WALL_BUSTER] ||
      player.achievements[ACHIEVEMENTS_ENUM.NICE_AND_TIDY] >
        cached.achievements[ACHIEVEMENTS_ENUM.NICE_AND_TIDY] ||
      player.achievements[ACHIEVEMENTS_ENUM.SUPERB_WORK] >
        cached.achievements[ACHIEVEMENTS_ENUM.SUPERB_WORK] ||
      player.achievements[ACHIEVEMENTS_ENUM.MONOLITH_MASHER] >
        cached.achievements[ACHIEVEMENTS_ENUM.MONOLITH_MASHER] ||
      player.achievements[ACHIEVEMENTS_ENUM.GET_THOSE_GOBLINS] >
        cached.achievements[ACHIEVEMENTS_ENUM.GET_THOSE_GOBLINS] ||
      player.achievements[ACHIEVEMENTS_ENUM.ANTI_ARTILLERY] >
        cached.achievements[ACHIEVEMENTS_ENUM.ANTI_ARTILLERY] ||
      player.achievements[ACHIEVEMENTS_ENUM.SHATTERED_AND_SCATTERED] >
        cached.achievements[ACHIEVEMENTS_ENUM.SHATTERED_AND_SCATTERED] ||
      player.achievements[ACHIEVEMENTS_ENUM.COUNTER_SPELL] >
        cached.achievements[ACHIEVEMENTS_ENUM.COUNTER_SPELL] ||
      player.achievements[ACHIEVEMENTS_ENUM.X_BOW_EXTERMINATOR] >
        cached.achievements[ACHIEVEMENTS_ENUM.X_BOW_EXTERMINATOR] ||
      player.achievements[ACHIEVEMENTS_ENUM.MORTAR_MAULER] >
        cached.achievements[ACHIEVEMENTS_ENUM.MORTAR_MAULER] ||
      player.achievements[ACHIEVEMENTS_ENUM.MULTI_ARCHER_TOWER_TERMINATOR] >
        cached.achievements[ACHIEVEMENTS_ENUM.MULTI_ARCHER_TOWER_TERMINATOR] ||
      player.achievements[ACHIEVEMENTS_ENUM.RICOCHET_CANNON_CRUSHER] >
        cached.achievements[ACHIEVEMENTS_ENUM.RICOCHET_CANNON_CRUSHER] ||
      player.achievements[ACHIEVEMENTS_ENUM.FIRESPITTER_FINISHER] >
        cached.achievements[ACHIEVEMENTS_ENUM.FIRESPITTER_FINISHER] ||
      player.achievements[ACHIEVEMENTS_ENUM.MULTI_GEAR_TOWER_TRAMPLER] >
        cached.achievements[ACHIEVEMENTS_ENUM.MULTI_GEAR_TOWER_TRAMPLER] ||
      player.achievements[ACHIEVEMENTS_ENUM.FIREFIGHTER] >
        cached.achievements[ACHIEVEMENTS_ENUM.FIREFIGHTER] ||
      (!forLastSeen &&
        (player.achievements[ACHIEVEMENTS_ENUM.WAR_HERO] >
          cached.achievements[ACHIEVEMENTS_ENUM.WAR_HERO] ||
          player.achievements[ACHIEVEMENTS_ENUM.WAR_LEAGUE_LEGEND] >
            cached.achievements[ACHIEVEMENTS_ENUM.WAR_LEAGUE_LEGEND] ||
          player.achievements[ACHIEVEMENTS_ENUM.SIEGE_SHARER] >
            cached.achievements[ACHIEVEMENTS_ENUM.SIEGE_SHARER] ||
          player.achievements[ACHIEVEMENTS_ENUM.FRIEND_IN_NEED] >
            cached.achievements[ACHIEVEMENTS_ENUM.FRIEND_IN_NEED] ||
          player.achievements[ACHIEVEMENTS_ENUM.SHARING_IS_CARING] >
            cached.achievements[ACHIEVEMENTS_ENUM.SHARING_IS_CARING]))
    );
  }

  private async _fetchMembers(player: APIPlayer, clan: APIClan) {
    const seasonId = Season.ID;
    const monthId = Season.monthId;
    const payload = transformAPIPlayer(player, { seasonId, monthId });

    const cached = await this.activity(player, payload);

    const restInc: UpdateFilter<PlayerSeasonEntity> = {
      $inc: {},
    };

    const restSet: UpdateFilter<PlayerSeasonEntity> = {
      $set: {},
    };

    if (cached && (player.builderBaseTrophies ?? 0) > (cached.builderBaseTrophies ?? 0)) {
      restInc.$inc = { ...restInc.$inc, builderBaseAttacksWon: 1 };
    }

    if (cached && (cached.builderBaseTrophies ?? 0) > (player.builderBaseTrophies ?? 0)) {
      restInc.$inc = { ...restInc.$inc, builderBaseAttacksLost: 1 };
    }

    if (cached?.clan && cached.clan.tag === clan.tag) {
      restSet.$set = {
        ...restSet.$set,
        [`clans.${clan.tag}.name`]: clan.name,
        [`clans.${clan.tag}.tag`]: clan.tag,
        [`clans.${clan.tag}.donations.current`]: player.donations,
        [`clans.${clan.tag}.donationsReceived.current`]: player.donationsReceived,
      };

      if (player.donations >= cached.clan.donations) {
        restInc.$inc = {
          ...restInc.$inc,
          [`clans.${clan.tag}.donations.total`]: player.donations - cached.clan.donations,
        };
      } else {
        restInc.$inc = {
          ...restInc.$inc,
          [`clans.${clan.tag}.donations.total`]: player.donations,
        };
      }

      if (player.donationsReceived >= cached.clan.donationsReceived) {
        restInc.$inc = {
          ...restInc.$inc,
          [`clans.${clan.tag}.donationsReceived.total`]:
            player.donationsReceived - cached.clan.donationsReceived,
        };
      } else {
        restInc.$inc = {
          ...restInc.$inc,
          [`clans.${clan.tag}.donationsReceived.total`]: player.donationsReceived,
        };
      }
    }

    const updateOne: UpdateOneModel<PlayerSeasonEntity> = {
      filter: { tag: player.tag, season: Season.ID },
      update: {
        $set: {
          'name': player.name,
          'townHallLevel': player.townHallLevel,
          'builderHallLevel': player.builderHallLevel,
          'attackWins': player.attackWins,
          'defenseWins': player.defenseWins,

          'trophies.current': player.trophies,
          'versusTrophies.current': player.builderBaseTrophies ?? 0,
          'versusBattleWins.current': 0,

          'capitalGoldContributions.current':
            payload.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION],
          'clanCapitalRaids.current': payload.achievements[ACHIEVEMENTS_ENUM.CLAN_CAPITAL_RAIDS],
          'clanGamesPoints.current': payload.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS],

          'darkElixirLoots.current': payload.achievements[ACHIEVEMENTS_ENUM.DARK_ELIXIR_LOOTS],
          'elixirLoots.current': payload.achievements[ACHIEVEMENTS_ENUM.ELIXIR_LOOTS],
          'goldLoots.current': payload.achievements[ACHIEVEMENTS_ENUM.GOLD_LOOTS],

          'siegeMachinesDonations.current': payload.achievements[ACHIEVEMENTS_ENUM.SIEGE_SHARER],
          'spellsDonations.current': payload.achievements[ACHIEVEMENTS_ENUM.SHARING_IS_CARING],
          'troopsDonations.current': payload.achievements[ACHIEVEMENTS_ENUM.FRIEND_IN_NEED],

          'clanWarLeagueStars.current': payload.achievements[ACHIEVEMENTS_ENUM.WAR_LEAGUE_LEGEND],
          'clanWarStars.current': payload.achievements[ACHIEVEMENTS_ENUM.WAR_HERO],

          ...restSet.$set,

          'updatedAt': new Date(),
        },
        $addToSet: {
          __clans: clan.tag,
        },
        $setOnInsert: {
          'trophies.initial': player.trophies,
          'versusBattleWins.initial': 0,
          'versusTrophies.initial': player.builderBaseTrophies ?? 0,

          'capitalGoldContributions.initial':
            payload.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION],
          'clanCapitalRaids.initial': payload.achievements[ACHIEVEMENTS_ENUM.CLAN_CAPITAL_RAIDS],
          'clanGamesPoints.initial': payload.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS],

          'clanWarLeagueStars.initial': payload.achievements[ACHIEVEMENTS_ENUM.WAR_LEAGUE_LEGEND],
          'clanWarStars.initial': payload.achievements[ACHIEVEMENTS_ENUM.WAR_HERO],

          'darkElixirLoots.initial': payload.achievements[ACHIEVEMENTS_ENUM.DARK_ELIXIR_LOOTS],
          'elixirLoots.initial': payload.achievements[ACHIEVEMENTS_ENUM.ELIXIR_LOOTS],
          'goldLoots.initial': payload.achievements[ACHIEVEMENTS_ENUM.GOLD_LOOTS],

          'siegeMachinesDonations.initial': payload.achievements[ACHIEVEMENTS_ENUM.SIEGE_SHARER],
          'spellsDonations.initial': payload.achievements[ACHIEVEMENTS_ENUM.SHARING_IS_CARING],
          'troopsDonations.initial': payload.achievements[ACHIEVEMENTS_ENUM.FRIEND_IN_NEED],

          'createdAt': new Date(),
        },
        ...restInc,
      },
      upsert: true,
    };

    if (
      cached?.name !== player.name ||
      cached.builderHallLevel !== player.builderHallLevel ||
      cached.townHallLevel !== player.townHallLevel ||
      cached.attackWins !== player.attackWins ||
      cached.defenseWins !== player.defenseWins ||
      cached.trophies !== player.trophies ||
      cached.builderBaseTrophies !== player.builderBaseTrophies ||
      this.didAchievementChange(payload, cached, false) ||
      cached.donations !== player.donations ||
      cached.donationsReceived !== player.donationsReceived ||
      (cached.clan && player.clan && cached.clan.tag !== player.clan.tag) ||
      (cached.clan && !player.clan) ||
      (!cached.clan && player.clan)
    ) {
      if (
        cached &&
        (cached?.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] !==
          payload.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] ||
          cached.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] !==
            payload.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION])
      ) {
        const monthly = this.monthly({ player: payload, clan, cached });
        return {
          seasonOps: [{ updateOne }],
          clanGamesOps: monthly.clanGamesOps,
          capitalContributionOps: monthly.capitalContributionOps,
        };
      }

      return {
        seasonOps: [{ updateOne }],
        clanGamesOps: [],
        capitalContributionOps: [],
      };
    }

    return {
      seasonOps: [],
      clanGamesOps: [],
      capitalContributionOps: [],
    };
  }

  private monthly({
    cached,
    player,
    clan,
  }: {
    cached: APIPlayerTransformed;
    player: APIPlayerTransformed;
    clan: APIClan;
  }) {
    const clanGamesOps: AnyBulkWriteOperation<ClanGamesEntity>[] = [];
    const capitalContributionOps: AnyBulkWriteOperation<CapitalContributionEntity>[] = [];

    if (
      cached.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] !==
        player.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] ||
      cached.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] !==
        player.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS]
    ) {
      const clanGamesPoints =
        player.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] -
        cached.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS];
      const totalClanGamesPoints =
        player.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] - cached.initialClanGamesPoints;
      if (clanGamesPoints > 0) {
        const $min = {
          ...(totalClanGamesPoints >= 4000 ? { completedAt: new Date() } : {}),
          ...(totalClanGamesPoints >= 5000 ? { _completedAt: new Date() } : {}),
        };
        const updateOne: UpdateOneModel<ClanGamesEntity> = {
          filter: { tag: player.tag, season: Season.monthId },
          update: {
            $set: {
              name: player.name,
              tag: player.tag,
              season: Season.monthId,
              current: player.achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS],
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
              initial: cached.initialClanGamesPoints,
              clan: {
                name: clan.name,
                tag: clan.tag,
              },
            },
            $addToSet: { __clans: clan.tag },
            ...(totalClanGamesPoints >= 4000 ? { $min } : {}),
            $push: {
              clans: {
                name: clan.name,
                tag: clan.tag,
                score: clanGamesPoints,
                timestamp: Date.now(),
              },
            },
          },
          upsert: true,
        };
        clanGamesOps.push({ updateOne });
      }

      const goldContributions =
        player.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION] -
        cached.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION];

      if (goldContributions > 0) {
        const insertOne: InsertOneModel<CapitalContributionEntity> = {
          document: {
            name: player.name,
            tag: player.tag,
            season: Season.monthId,
            initial: cached.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION],
            current: player.achievements[ACHIEVEMENTS_ENUM.CAPITAL_CONTRIBUTION],
            clan: {
              name: clan.name,
              tag: clan.tag,
              contributed: goldContributions,
            },
            createdAt: new Date(),
          },
        };
        capitalContributionOps.push({ insertOne });
      }
    }

    return { clanGamesOps, capitalContributionOps };
  }

  @OnEvent(WorkerEvents.PLAYER_UPSTREAM)
  async onUpstreamFeed(data: any) {
    await this.publisher.publish(RedisChannels.UPSTREAM_FEED, JSON.stringify(data));
  }

  public async query(clanTag: string, clan: APIClan) {
    if (!this.event) return null;
    if (!this.cached.has(clanTag)) return null;
    const cursor = this.db.collection(Collections.CLAN_GAMES_POINTS).aggregate<ClanGamesEntity>([
      {
        $match: {
          __clans: clanTag,
          tag: { $in: clan.memberList.map((m) => m.tag) },
          season: Season.monthId,
        },
      },
      {
        $limit: 60,
      },
    ]);

    const members = await cursor.toArray();
    return this.countTotal(clan, members);
  }

  public async startPolling(tag: string) {
    if (!this.cached.has(tag)) return null;

    const clan = await this.redisService.getClan(tag);
    if (!clan) return null;

    await this.exec(clan, clan.memberList);

    if (this.event) {
      const updated = await this.query(tag, clan);
      this.eventEmitter.emit(WorkerEvents.PLAYER_UPSTREAM, {
        tag,
        clan: {
          tag: clan.tag,
          name: clan.name,
          members: clan.members,
          warWins: clan.warWins,
          badgeUrls: clan.badgeUrls,
          description: clan.description,
          isWarLogPublic: clan.isWarLogPublic,
          warWinStreak: clan.warWinStreak,
          warLosses: clan.warLosses ?? 0,
          warTies: clan.warTies ?? 0,
        },
        members: updated?.members ?? [],
        total: updated?.total ?? 0,
        op: Flags.CLAN_GAMES_LOG,
      });
      return updated;
    }
  }

  private async countTotal(clan: APIClan, dbMembers: ClanGamesEntity[]) {
    const db = this.db.collection(Collections.CLAN_GAMES);
    const { members, total } = this.filter(dbMembers, clan);

    const _total = dbMembers.reduce((prev, mem) => {
      const gained = mem.current - mem.initial;
      return prev + Math.min(4000, gained);
    }, 0);

    const maxTotal = dbMembers.reduce((prev, mem) => {
      const gained = mem.current - mem.initial;
      return prev + Math.min(5000, gained);
    }, 0);

    const expiresAt = new Date();
    expiresAt.setDate(CLAN_GAMES_STARTING_DATE + 6);
    expiresAt.setHours(0, 0, 0, 0);

    const $min = {
      ...(_total >= 50_000 ? { completedAt: new Date() } : {}),
      ...(maxTotal >= 75_000 ? { _completedAt: new Date() } : {}),
    };

    await db.updateOne(
      { tag: clan.tag, season: Season.monthId },
      {
        $set: { name: clan.name, season: Season.monthId },
        $max: {
          participants: dbMembers.filter((m) => m.current - m.initial >= 1).length,
          maxCount: dbMembers.filter((m) => m.current - m.initial >= 4000).length,
          _maxCount: dbMembers.filter((m) => m.current - m.initial >= 5000).length,
          total: Number(_total),
          _total: Number(maxTotal),
        },
        ...(_total >= 50_000 || maxTotal >= 75_000 ? { $min } : {}),
      },
      { upsert: true },
    );

    return { members, total };
  }

  private filter(dbMembers: ClanGamesEntity[] = [], clan: APIClan) {
    const total = dbMembers.reduce((prev, mem) => {
      const gained = mem.current - mem.initial;
      return prev + Math.min(this.MAX_POINT, gained);
    }, 0);

    const members = dbMembers.map((mem) => {
      const gained = mem.current - mem.initial;
      return {
        tag: mem.tag,
        name: mem.name,
        endedAt: mem.completedAt,
        points: Math.min(this.MAX_POINT, gained),
      };
    });

    const clanMembers = clan.memberList
      .filter((mem) => !members.find((m) => m.tag === mem.tag))
      .map((mem) => ({
        name: mem.name,
        tag: mem.tag,
        points: 0,
        endedAt: null,
      }));

    return {
      total,
      members: [...members, ...clanMembers]
        .sort((a, b) => b.points - a.points)
        .sort((a, b) => {
          if (a.endedAt && b.endedAt) {
            return a.endedAt.getTime() - b.endedAt.getTime();
          }
          return 0;
        }),
    };
  }

  private get event() {
    const START = new Date();
    START.setDate(CLAN_GAMES_STARTING_DATE);
    START.setHours(0, 0, 0, 0);

    const END = new Date();
    END.setDate(CLAN_GAMES_STARTING_DATE + 6);
    END.setHours(14, 0, 0, 0);

    return new Date() >= new Date(START) && new Date() <= new Date(END);
  }

  async enqueue(debug = true) {
    if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
      this.logger.debug(`Starting Requests (${this.cached.size} players) [bulk ${this.bulkSize}]`);
    }
    const startTime = Date.now();

    try {
      for (const tags of chunk(Array.from(this.cached.keys()), this.bulkSize)) {
        if (this.workerService.isInMaintenance) continue;
        await Promise.all(tags.map((tag) => this.startPolling(tag)));
      }

      if (!this.workerService.isInMaintenance) {
        await this.redis.hset(
          RedisKeys.LOOP_TIMINGS,
          RedisKeys.PLAYER_LOOP,
          JSON.stringify({ timeTaken: Date.now() - startTime, timestamp: Date.now() }),
        );
      }
    } finally {
      const timeTaken = Date.now() - startTime;
      if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
        this.logger.verbose(
          `Finished Requests [${formatDuration(timeTaken)}] (Players, bulk ${this.bulkSize})`,
        );
      }

      setTimeout(
        this.enqueue.bind(this),
        (timeTaken >= this.refreshInterval ? 0 : this.refreshInterval - timeTaken) + 60000,
        false,
      );
    }
  }

  @OnEvent(WorkerEvents.CLANS_LOADED)
  public onWorkerInit(clans: WorkerInitDto[]) {
    if (process.env.PLAYER_TRACKING !== '1') return;

    clans.forEach((data) => {
      const cache = this.cached.get(data.tag) ?? {};
      this.cached.set(data.tag, { ...cache, tag: data.tag });
    });

    return this.enqueue();
  }

  @OnEvent(WorkerEvents.CLAN_ADDED)
  async add(data: { tag: string }) {
    if (process.env.PLAYER_TRACKING !== '1') return;

    const existing = this.cached.has(data.tag);
    this.cached.set(data.tag, { tag: data.tag });
    if (!existing) return this.startPolling(data.tag);
  }

  @OnEvent(WorkerEvents.CLAN_REMOVED)
  public delete(tag: string) {
    return this.cached.delete(tag);
  }

  private get MAX_POINT() {
    return [0, 7, 11].includes(new Date().getMonth()) ? 5_000 : 4_000;
  }
}
