import { ClashClient, ClashClientService, Season } from '@app/clash-client';
import {
  Flags,
  LEGEND_LEAGUE_ID,
  LogType,
  RedisChannels,
  RedisKeys,
  RolePositions,
  UNRANKED_TIER,
  WorkerEvents,
} from '@app/constants';
import { formatDuration } from '@app/helpers';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { APIClan } from 'clashofclans.js';
import Redis from 'ioredis';
import { AnyBulkWriteOperation, Db } from 'mongodb';
import { Collections, MONGODB_TOKEN, REDIS_PUB_TOKEN, REDIS_TOKEN } from '../db';
import { Elastic, ELASTIC_TOKEN } from '../db/elastic.module';
import { MongoService } from '../db/mongodb.service';
import { RedisService } from '../db/redis.service';
import { BulkWriterService } from '../tasks/bulk-writer.service';
import { LastSeenMembersInputDto, WorkerInitDto } from '../util/dto';
import { Emitter } from '../util/emitter';
import { WorkerService } from '../worker.service';

@Injectable()
export class ClansService {
  private logger = new Logger(ClansService.name);
  private cached = new Map<string, { tag: string }>();

  private refreshInterval = 2 * 60 * 1000;
  private clashClient: ClashClient;

  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(REDIS_PUB_TOKEN) private publisher: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    @Inject(ELASTIC_TOKEN) private elastic: Elastic,
    private workerService: WorkerService,
    private redisService: RedisService,
    private eventEmitter: Emitter,
    private mongoService: MongoService,
    private bulkWriter: BulkWriterService,
    private clashClientService: ClashClientService,
  ) {
    this.clashClient = this.clashClientService.getClient();
  }

  async enqueue(debug = true) {
    if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
      this.logger.debug(`Fetching ${this.cached.size} items`);
    }
    const startTime = Date.now();

    try {
      for (const clanTag of this.cached.keys()) {
        if (this.workerService.isInMaintenance) continue;
        await this.startPolling(clanTag);
      }

      if (!this.workerService.isInMaintenance) {
        await this.redis.hset(
          RedisKeys.LOOP_TIMINGS,
          RedisKeys.CLAN_LOOP,
          JSON.stringify({ timeTaken: Date.now() - startTime, timestamp: Date.now() }),
        );
      }
    } finally {
      const timeTaken = Date.now() - startTime;
      if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
        this.logger.verbose(
          `Finished Requests [${formatDuration(timeTaken)}] (${this.cached.size} clans)`,
        );
      }

      setTimeout(
        this.enqueue.bind(this),
        (timeTaken >= this.refreshInterval ? 0 : this.refreshInterval - timeTaken) + 5000,
        false,
      );
    }
  }

  async startPolling(tag: string) {
    const { res, body: clan } = await this.clashClient.getClan(tag);

    if (res.status === 404 || (res.ok && clan.memberList.length === 0)) {
      this.cached.delete(tag);
      return this.mongoService.disableClan(tag);
    }

    if (!res.ok) return;

    const oldClan = await this.getCache(clan);
    if (!oldClan) return;

    const oldMembers = oldClan.memberList;
    const oldMemberList = [...oldMembers.map((m) => m.tag)];
    const CurrentMemberList = [...clan.memberList.map((m) => m.tag)];
    const oldMember = (tag: string) => oldMembers.find((m) => m.tag === tag)!;

    const players: LastSeenMembersInputDto[] = [];
    const data: any = {
      tag,
      donations: 0,
      receives: 0,
      donated: [],
      received: [],
      op: Flags.DONATION_LOG,
      clan: {
        tag: clan.tag,
        name: clan.name,
        members: clan.members,
        badge: clan.badgeUrls.large,
      },
      insertedAt: new Date(),
    };

    for (const member of clan.memberList) {
      const townHallLevel = member.townHallLevel;
      const mem = oldMember(member.tag);

      // Existing Members
      if (oldMemberList.includes(member.tag)) {
        // Donation Tracking
        const donations = member.donations - mem.donations;
        if (donations && donations > 0) {
          data.donations += donations;
          data.donated.push({
            hall: townHallLevel,
            league: member.leagueTier?.id || UNRANKED_TIER,
            name: member.name,
            tag: member.tag,
            donated: donations,
          });
        }
        const receives = member.donationsReceived - mem.donationsReceived;
        if (receives && receives > 0) {
          data.receives += receives;
          data.received.push({
            hall: townHallLevel,
            league: member.leagueTier?.id || UNRANKED_TIER,
            name: member.name,
            tag: member.tag,
            received: receives,
          });
        }

        // Activity Tracking
        if (
          mem.donations < member.donations ||
          mem.builderBaseTrophies !== member.builderBaseTrophies ||
          mem.name !== member.name ||
          (mem.trophies < member.trophies && member.leagueTier.id !== LEGEND_LEAGUE_ID)
        ) {
          players.push({
            name: member.name,
            tag: member.tag, //
            leagueId: member.leagueTier?.id || UNRANKED_TIER,
            townHallLevel,
            trophies: member.trophies,
          });
        }
      }

      // New Joiners
      if (!oldMemberList.includes(member.tag)) {
        const donations = member.donations;
        if (donations && donations > 0) {
          data.donations += donations;
          data.donated.push({
            league: member.leagueTier?.id || UNRANKED_TIER,
            name: member.name,
            tag: member.tag,
            donated: donations,
            hall: townHallLevel,
          });
        }
        const receives = member.donationsReceived;
        if (receives && receives > 0) {
          data.receives += receives;
          data.received.push({
            league: member.leagueTier?.id || UNRANKED_TIER,
            name: member.name,
            tag: member.tag,
            received: receives,
            hall: townHallLevel,
          });
        }

        // Activity Tracking
        players.push({
          name: member.name,
          tag: member.tag,
          leagueId: member.leagueTier?.id || UNRANKED_TIER,
          townHallLevel,
          trophies: member.trophies,
        });
      }
    }

    // Publish Donation Log
    if (data.donated.length || data.received.length) {
      this.eventEmitter.emit(WorkerEvents.CLAN_UPSTREAM, data);

      const donations: any[] = data.donated.map((d) => ({
        name: d.name,
        tag: d.tag,
        value: d.donated,
        action: 'DONATED',
        clan: clan.name,
        clanTag: clan.tag,
        createdAt: Math.floor(Date.now() / 1000),
      }));
      const receives: any[] = data.received.map((d) => ({
        name: d.name,
        tag: d.tag,
        value: d.received,
        action: 'RECEIVED',
        clan: clan.name,
        clanTag: clan.tag,
        createdAt: Math.floor(Date.now() / 1000),
      }));

      const payload = {
        clanTag: clan.tag,
        members: [
          ...data.donated.map((d) => ({
            op: 'DONATED',
            tag: d.tag,
            name: d.name,
            leagueId: d.league,
            townHallLevel: d.hall,
            donations: d.donated,
            donationsReceived: 0,
          })),
          ...data.received.map((r) => ({
            op: 'RECEIVED',
            tag: r.tag,
            name: r.name,
            leagueId: r.league,
            townHallLevel: r.hall,
            donations: 0,
            donationsReceived: r.received,
          })),
        ],
        clan: {
          tag: clan.tag,
          name: clan.name,
          badgeUrl: clan.badgeUrls.large,
          members: clan.members,
        },
        logType: LogType.DONATION_LOG,
        op: Flags.DONATION_LOG_V2,
      };
      this.eventEmitter.emit(WorkerEvents.CLAN_UPSTREAM, payload);

      this.bulkWriter.donations.push(...donations, ...receives);
    }

    // Clan Level Change
    if (oldClan.clanLevel !== clan.clanLevel) {
      const packet = {
        tag,
        op: Flags.CLAN_EVENT_LOG,
        clan: {
          tag: clan.tag,
          name: clan.name,
          level: clan.clanLevel,
          badge: clan.badgeUrls.large,
          badgeUrl: clan.badgeUrls.large,
        },
        memberList: [],
        members: [],
        type: 'CLAN_LEVEL_UP',
      };
      this.eventEmitter.emit(WorkerEvents.CLAN_UPSTREAM, packet);
      this.eventEmitter.emit(WorkerEvents.CLAN_UPDATE_DETECTED, [
        {
          name: clan.name,
          tag: clan.tag,
          op: 'CLAN_LEVEL_UP',
          value: clan.clanLevel,
          created_at: new Date(),
        },
      ]);
    }

    // Clan League Change
    if (oldClan.warLeague?.id !== clan.warLeague?.id) {
      const packet = {
        tag,
        op: Flags.CLAN_EVENT_LOG,
        clan: {
          tag: clan.tag,
          name: clan.name,
          badge: clan.badgeUrls.large,
          badgeUrl: clan.badgeUrls.large,
          level: clan.clanLevel,
          oldWarLeague: oldClan.warLeague,
          warLeague: clan.warLeague,
        },
        type: 'WAR_LEAGUE_CHANGE',
      };
      this.eventEmitter.emit(WorkerEvents.CLAN_UPSTREAM, packet);
      this.eventEmitter.emit(WorkerEvents.CLAN_UPDATE_DETECTED, [
        {
          name: clan.name,
          tag: clan.tag,
          op: 'WAR_LEAGUE_CHANGE',
          value: clan.warLeague?.id ?? 48000000,
          created_at: new Date(),
        },
      ]);
    }

    // Clan Capital League Change
    if (oldClan.capitalLeague?.id !== clan.capitalLeague?.id) {
      const packet = {
        tag,
        op: Flags.CLAN_EVENT_LOG,
        clan: {
          tag: clan.tag,
          name: clan.name,
          level: clan.clanLevel,
          badge: clan.badgeUrls.large,
          badgeUrl: clan.badgeUrls.large,
          oldCapitalLeague: oldClan.capitalLeague,
          capitalLeague: clan.capitalLeague,
        },
        type: 'CAPITAL_LEAGUE_CHANGE',
      };
      this.eventEmitter.emit(WorkerEvents.CLAN_UPSTREAM, packet);
      this.eventEmitter.emit(WorkerEvents.CLAN_UPDATE_DETECTED, [
        {
          name: clan.name,
          tag: clan.tag,
          op: 'CAPITAL_LEAGUE_CHANGE',
          value: clan.capitalLeague?.id ?? 85000000,
          created_at: new Date(),
        },
      ]);
    }

    // Clan Capital Hall Level Change
    if (oldClan.clanCapital.capitalHallLevel !== clan.clanCapital.capitalHallLevel) {
      const packet = {
        tag,
        op: Flags.CLAN_EVENT_LOG,
        clan: {
          tag: clan.tag,
          name: clan.name,
          badge: clan.badgeUrls.large,
          badgeUrl: clan.badgeUrls.large,
          level: clan.clanLevel,
          capitalHallLevel: clan.clanCapital.capitalHallLevel,
        },
        type: 'CAPITAL_HALL_LEVEL_UP',
      };
      this.eventEmitter.emit(WorkerEvents.CLAN_UPSTREAM, packet);
      this.eventEmitter.emit(WorkerEvents.CLAN_UPDATE_DETECTED, [
        {
          name: clan.name,
          tag: clan.tag,
          op: 'CAPITAL_HALL_LEVEL_UP',
          value: clan.clanCapital.capitalHallLevel,
          created_at: new Date(),
        },
      ]);
    }

    if (CurrentMemberList.length && oldMemberList.length) {
      const members: any[] = [];
      // LEFT
      for (const mTag of oldMemberList.filter((tag) => !CurrentMemberList.includes(tag))) {
        const mem = oldMember(mTag);
        members.push({
          tag: mTag,
          op: 'LEFT',
          role: 'none',
          name: mem.name,
          donations: mem.donations,
          donationsReceived: mem.donationsReceived,
        });
      }

      // JOINED
      for (const mTag of CurrentMemberList.filter((tag) => !oldMemberList.includes(tag))) {
        const mem = clan.memberList.find((m) => m.tag === mTag)!;
        members.push({
          tag: mTag,
          op: 'JOINED',
          name: mem.name,
          role: mem.role,
          donations: mem.donations,
          donationsReceived: mem.donationsReceived,
        });
      }

      // STILL IN CLAN
      for (const mem of clan.memberList.filter((mem) => oldMemberList.includes(mem.tag))) {
        const oldMem = oldMember(mem.tag);

        // role change
        if (mem.role !== oldMem.role) {
          members.push({
            tag: mem.tag,
            role: mem.role,
            name: mem.name,
            donations: mem.donations,
            donationsReceived: mem.donationsReceived,
            op: RolePositions[mem.role] > RolePositions[oldMem.role] ? 'PROMOTED' : 'DEMOTED',
          });
        }

        // name change
        if (mem.name !== oldMem.name) {
          members.push({
            tag: mem.tag,
            role: mem.role,
            name: oldMem.name,
            donations: mem.donations,
            donationsReceived: mem.donationsReceived,
            op: 'NAME_CHANGE',
          });
        }

        // league change
        if (
          mem.leagueTier &&
          oldMem.leagueTier &&
          mem.leagueTier.id !== oldMem.leagueTier.id &&
          !Season.ending
        ) {
          members.push({
            tag: mem.tag,
            role: mem.role,
            name: mem.name,
            donations: mem.donations,
            trophies: mem.trophies,
            donationsReceived: mem.donationsReceived,
            meta: { old: oldMem.leagueTier.id, new: mem.leagueTier.id },
            op: 'LEAGUE_CHANGE',
          });
        }

        // builder base league change
        if (
          mem.builderBaseLeague &&
          oldMem.builderBaseLeague &&
          mem.builderBaseLeague.id !== oldMem.builderBaseLeague.id &&
          !Season.ending
        ) {
          members.push({
            tag: mem.tag,
            role: mem.role,
            name: mem.name,
            donations: mem.donations,
            donationsReceived: mem.donationsReceived,
            meta: { old: oldMem.builderBaseLeague.id, new: mem.builderBaseLeague.id },
            op: 'BUILDER_LEAGUE_CHANGE',
          });
        }
      }

      if (members.length) {
        const data = {
          tag,
          members: members.map((mem) => ({
            op: mem.op,
            tag: mem.tag,
            role: mem.role,
            name: mem.name,
            rand: Math.random(),
            donations: mem.donations,
            meta: mem.meta,
            donationsReceived: mem.donationsReceived,
          })),
          memberList: clan.memberList.map((mem) => ({
            tag: mem.tag,
            name: mem.name,
            role: mem.role,
            clan: { tag: clan.tag },
          })),
          clan: {
            name: clan.name,
            tag: clan.tag,
            badge: clan.badgeUrls.large,
            badgeUrl: clan.badgeUrls.large,
          },
          op: Flags.CLAN_FEED_LOG,
          insertedAt: new Date(),
        };
        this.eventEmitter.emit(WorkerEvents.CLAN_UPSTREAM, data);

        this.eventEmitter.emit(
          WorkerEvents.JOIN_LEAVE_DETECTED,
          clan,
          members.filter((mem) => ['LEFT', 'JOINED'].includes(mem.op)),
        );
      }
    }

    await this.updateLastSeen(tag, clan, players);
  }

  async getCache(clan: APIClan): Promise<APIClan | null> {
    const cache = await this.redisService.getClan(clan.tag);
    await this.redisService.setClan(clan);
    return cache;
  }

  async updateLastSeen(tag: string, clan: APIClan, members: LastSeenMembersInputDto[] = []) {
    const cache = this.cached.get(tag);
    if (!cache) return null;

    const ops: AnyBulkWriteOperation<any>[] = [];
    const collection = this.db.collection(Collections.PLAYERS);
    for (const m of members) {
      const updates = {
        name: m.name,
        clan: {
          tag: clan.tag,
          name: clan.name,
        },
        trophies: m.trophies,
        leagueId: m.leagueId,
        townHallLevel: m.townHallLevel,
        lastSeen: new Date(),
      };

      ops.push({
        updateOne: {
          filter: { tag: m.tag },
          upsert: true,
          update: { $set: updates },
        },
      });
    }

    if (ops.length) {
      await collection.bulkWrite(ops, { ordered: false });
    }
  }

  @OnEvent(WorkerEvents.JOIN_LEAVE_DETECTED)
  onJoinLeave(clan: APIClan, players: { tag: string; op: string }[]) {
    if (!players.length) return null;

    this.bulkWriter.activities.push(
      ...players.map((player) => ({
        tag: player.tag,
        clanTag: clan.tag,
        timestamp: Math.floor(Date.now() / 1000),
        action: player.op === 'JOINED' ? ('JOINED_CLAN' as const) : ('LEFT_CLAN' as const),
      })),
    );
  }

  @OnEvent(WorkerEvents.CLAN_UPDATE_DETECTED)
  async onClanUpdate(events: any[]) {
    const operations = events.flatMap((ev) => [{ index: { _index: 'clan_event_logs' } }, ev]);
    await this.elastic.bulk({ refresh: false, operations });
  }

  @OnEvent(WorkerEvents.CLAN_UPSTREAM)
  async onUpstreamFeed(data: any) {
    await this.publisher.publish(RedisChannels.UPSTREAM_FEED, JSON.stringify(data));
  }

  @OnEvent(WorkerEvents.CLANS_LOADED)
  onWorkerInit(clans: WorkerInitDto[]) {
    if (process.env.CLAN_TRACKING !== '1') return;

    for (const data of clans) {
      const cache = this.cached.get(data.tag) ?? {
        tag: data.tag,
      };
      this.cached.set(data.tag, cache);
    }
    return this.enqueue();
  }

  @OnEvent(WorkerEvents.CLAN_ADDED)
  async add(data: { tag: string }) {
    if (process.env.CLAN_TRACKING !== '1') return;

    const existing = this.cached.has(data.tag);
    this.cached.set(data.tag, { tag: data.tag });
    if (!existing) return this.startPolling(data.tag);
  }

  @OnEvent(WorkerEvents.CLAN_REMOVED)
  public delete(tag: string) {
    return this.cached.delete(tag);
  }
}
