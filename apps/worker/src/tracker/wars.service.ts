import {
  ClashClient,
  ClashClientService,
  getPreviousBestAttack,
  Season,
} from '@app/clash-client';
import { Flags, RedisChannels, RedisKeys, WarType, WorkerEvents } from '@app/constants';
import { formatDuration } from '@app/helpers';
import { Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  APIClanWar,
  APIClanWarAttack,
  APIClanWarMember,
  APIWarClan,
  UNRANKED_WAR_LEAGUE_ID,
} from 'clashofclans.js';
import cluster from 'cluster';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import moment from 'moment';
import { AnyBulkWriteOperation, Db, WithId } from 'mongodb';
import {
  ClanWarsEntity,
  Collections,
  CWLGroupsEntity,
  MONGODB_TOKEN,
  REDIS_PUB_TOKEN,
  REDIS_TOKEN,
} from '../db';
import { BulkWriterService } from '../tasks/bulk-writer.service';
import { WorkerInitDto } from '../util/dto';
import { Emitter } from '../util/emitter';
import { WorkerService } from '../worker.service';

interface Cache {
  tag: string;
  maxAge?: Date;
}

export class WarsService {
  private logger = new Logger(WarsService.name);
  private refreshInterval = 2 * 60 * 1000;
  private cached: Map<string, Cache> = new Map();
  private clashClient: ClashClient;

  public constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    @Inject(REDIS_PUB_TOKEN) private publisher: Redis,
    @Inject(MONGODB_TOKEN) private db: Db,
    private workerService: WorkerService,
    private eventEmitter: Emitter,
    private bulkWriter: BulkWriterService,
    private clashClientService: ClashClientService,
  ) {
    this.clashClient = this.clashClientService.getClient();
  }

  public get collection() {
    return this.db.collection(Collections.CLAN_WARS);
  }

  private async exec(tag: string, cache: Cache) {
    return await Promise.all([
      this.getClanWarLeagueGroups(tag, cache),
      this.getClanWar(tag, cache),
    ]);
  }

  private newMaxAge(cache: Cache, maxAge: number) {
    cache.maxAge = new Date(Date.now() + Math.min(600 * 1000, maxAge));
  }

  private toDate(ISO: string | Date) {
    return new Date(moment(ISO).toDate());
  }

  private isFriendly(data: APIClanWar) {
    const friendlyWarTimes = [
      1000 * 60 * 60 * 24,
      1000 * 60 * 60 * 20,
      1000 * 60 * 60 * 16,
      1000 * 60 * 60 * 12,
      1000 * 60 * 60 * 8,
      1000 * 60 * 60 * 6,
      1000 * 60 * 60 * 4,
      1000 * 60 * 60 * 2,
      1000 * 60 * 60,
      1000 * 60 * 30,
      1000 * 60 * 15,
      1000 * 60 * 5,
    ];
    return friendlyWarTimes.includes(
      this.toDate(data.startTime).getTime() - this.toDate(data.preparationStartTime).getTime(),
    );
  }

  private createId(data: APIClanWar | ClanWarsEntity) {
    const ISO = this.toDate(data.preparationStartTime).toISOString().slice(0, 16);
    return `${ISO}-${[data.clan.tag, data.opponent.tag].sort((a, b) => a.localeCompare(b)).join('-')}`;
  }

  private async getWarId() {
    const cursor = this.collection.find().sort({ id: -1 }).limit(1);
    const uuid: number = (await cursor.next())?.id ?? 0;
    return uuid + 1;
  }

  private async getLeagueGroupId() {
    const cursor = this.db.collection(Collections.CWL_GROUPS).find().sort({ id: -1 }).limit(1);
    const uuid: number = (await cursor.next())?.id ?? 0;
    return uuid + 1;
  }

  private async insertOne(
    { data, warTag, leagueGroupId } = {} as {
      data: APIClanWar;
      clanTag: string;
      warTag?: string;
      leagueGroupId?: number;
    },
  ) {
    const warData = {
      state: data.state,
      opponent: data.opponent,
      clan: data.clan,
      updatedAt: new Date(),
      endTime: this.toDate(data.endTime),
      startTime: this.toDate(data.startTime),
      preparationStartTime: this.toDate(data.preparationStartTime),
      battleModifier: data.battleModifier,
    };
    const uid = this.createId(data);

    const updated = await this.collection.updateOne({ uid }, { $set: warData });
    if (updated.matchedCount) return updated;

    const { upsertedCount } = await this.collection.updateOne(
      { uid },
      {
        $set: warData,
        $setOnInsert:
          typeof warTag === 'string'
            ? {
                id: await this.getWarId(),
                season: Season.monthId,
                warType: WarType.CWL,
                leagueGroupId,
                warTag,
                teamSize: data.teamSize || data.clan.members.length,
                attacksPerMember: data.attacksPerMember ?? 1,
              }
            : {
                id: await this.getWarId(),
                season: Season.monthId,
                warType: this.isFriendly(data) ? WarType.FRIENDLY : WarType.REGULAR,
                teamSize: data.teamSize || data.clan.members.length,
                attacksPerMember: data.attacksPerMember ?? 2,
              },
      },
      { upsert: true },
    );

    if (upsertedCount) await this.createReminders({ warTag, data, uid });
  }

  private async createReminders({
    data,
    warTag,
    uid,
  }: {
    data: APIClanWar;
    uid: string;
    warTag?: string;
  }) {
    if (await this.redis.get(`WAR_REM:${uid}`)) return null;

    if (['notInWar', 'warEnded'].includes(data.state)) return null;
    const reminders = await this.db
      .collection(Collections.REMINDERS)
      .find({ clans: { $in: [data.clan.tag, data.opponent.tag] } })
      .toArray();
    if (!reminders.length) return null;

    await this.redis.set(`WAR_REM:${uid}`, '0', 'EX', 60 * 60 * 24 * 2.1);

    const newRems: any[] = [];
    const rand = Math.random();
    const isFriendly = warTag ? false : this.isFriendly(data);
    const maxDuration =
      this.toDate(data.endTime).getTime() - this.toDate(data.preparationStartTime).getTime();
    const gracePeriod = 30 * 60 * 1000;

    for (const reminder of reminders) {
      const dur = reminder.duration >= 1000 * 60 * 60 * 46 ? maxDuration : reminder.duration;

      const diff = this.toDate(data.endTime).getTime() - dur;
      const aWhileAgo = dur >= maxDuration && Math.abs(Date.now() - diff) <= gracePeriod;

      if (Date.now() > new Date(diff).getTime() && !aWhileAgo) continue;

      const warType = warTag ? 'cwl' : isFriendly ? 'friendly' : 'normal';
      if (!reminder.warTypes.includes(warType)) continue;

      const schedule = {
        key: uid,
        guild: reminder.guild,
        name: data.clan.name,
        tag: data.clan.tag,
        duration: reminder.duration,
        reminderId: reminder._id,
        triggered: false,
        source: `rpc_${cluster.worker?.id ?? 0}_${rand}`,
        isFriendly: isFriendly,
        warTag: warTag,
        timestamp: new Date(this.toDate(data.endTime).getTime() - reminder.duration),
        createdAt: new Date(),
      };

      if (reminder.clans.includes(data.clan.tag)) {
        newRems.push({ ...schedule, name: data.clan.name, tag: data.clan.tag });
      }
      if (reminder.clans.includes(data.opponent.tag)) {
        newRems.push({ ...schedule, name: data.opponent.name, tag: data.opponent.tag });
      }
    }

    if (!newRems.length) return null;
    try {
      await this.db.collection(Collections.SCHEDULERS).insertMany(newRems);
    } catch {
      this.logger.debug(`Duplicate detected (${data.clan.tag}/${data.opponent.tag})`);
    }
  }

  private clanRosterChanged(
    oldMembers: APIClanWarMember[] = [],
    newMembers: APIClanWarMember[] = [],
  ) {
    return this.replacedRosters(oldMembers, newMembers).changed;
  }

  private replacedRosters(
    oldMembers: APIClanWarMember[] = [],
    newMembers: APIClanWarMember[] = [],
  ) {
    const newMemberTags = new Set(newMembers.map((mem) => mem.tag));
    const oldMemberTags = new Set(oldMembers.map((mem) => mem.tag));

    const _oldMembers = oldMembers.filter((oldMem) => !newMemberTags.has(oldMem.tag));
    const _newMembers = newMembers.filter((newMem) => !oldMemberTags.has(newMem.tag));

    return {
      oldMembers: _oldMembers,
      newMembers: _newMembers,
      changed: _newMembers.length + _oldMembers.length > 0,
    };
  }

  private findNewAttacks(
    oldMembers: APIClanWarMember[],
    newMembers: APIClanWarMember[],
    opponentMembers: APIClanWarMember[],
    clanTag: string,
  ) {
    const oldAttacks = new Set(
      oldMembers
        .map((m) => m.attacks || [])
        .flat()
        .map((a) => a.order),
    );

    const check = new Map(opponentMembers.map((m) => [m.tag, m]));
    const allAttacks = newMembers.flatMap((m) => m.attacks ?? []);

    return newMembers
      .flatMap((member) =>
        (member.attacks ?? []).map((attack) => {
          const defender = check.get(attack.defenderTag)!;
          const previous =
            !oldAttacks.has(attack.order) && getPreviousBestAttack(allAttacks, attack);

          return {
            clanTag,
            name: member.name,
            tag: member.tag,
            mapPosition: member.mapPosition,
            townhallLevel: member.townhallLevel,
            defender: {
              tag: defender.tag,
              name: defender.name,
              mapPosition: defender.mapPosition,
              townhallLevel: defender.townhallLevel,
            },
            attack: {
              ...attack,
              oldStars: previous ? previous.stars : 0,
            },
          };
        }),
      )
      .filter(({ attack }) => !oldAttacks.has(attack.order));
  }

  private warStateUpdated(oldData: ClanWarsEntity, newData: APIClanWar, groupWar = false) {
    return (
      oldData.state !== newData.state ||
      oldData.clan.attacks !== newData.clan.attacks ||
      oldData.opponent.attacks !== newData.opponent.attacks ||
      (groupWar &&
        newData.state === 'preparation' &&
        this.clanRosterChanged(oldData.clan.members, newData.clan.members)) ||
      (groupWar &&
        newData.state === 'preparation' &&
        this.clanRosterChanged(oldData.opponent.members, newData.opponent.members))
    );
  }

  private transformData(data: APIClanWar) {
    const clanTag = [data.clan.tag, data.opponent.tag].sort((a, b) => a.localeCompare(b))[0];
    return {
      ...data,
      clan: data.clan.tag === clanTag ? data.clan : data.opponent,
      opponent: data.clan.tag === clanTag ? data.opponent : data.clan,
    };
  }

  // For Normal Clan Wars [CLAN WAR]
  private async getClanWar(tag: string, cache: Cache) {
    const { res, body } = await this.clashClient.getCurrentWar(tag);
    this.newMaxAge(cache, res.maxAge);
    if (!res.ok) return;

    const uid = body.state === 'notInWar' ? '0x' : this.createId(body);
    if (['notInWar', 'preparation'].includes(body.state)) {
      const prevId = await this.redis.get(`WAR_UID:${tag}`);
      if (prevId && prevId !== uid) {
        const db = await this.collection.findOne({ uid: prevId, state: 'inWar' });
        if (db) await this.broadcastMissed(tag, db.warType, db);
      }
    }
    if (body.state === 'notInWar') return;

    const db = await this.db.collection(Collections.CLAN_WARS).findOne({ uid });
    const data = this.transformData(body);

    await this.redis
      .multi()
      .set(`WAR_UID:${data.clan.tag}`, uid, 'EX', 15 * 60)
      .set(`WAR_UID:${data.opponent.tag}`, uid, 'EX', 15 * 60)
      .exec();

    const stateChanged = db && this.warStateUpdated(db, data, false);

    if (!(db && ['warEnded', 'preparation'].includes(db.state)) || data.state !== db.state) {
      await this.insertOne({ data, clanTag: tag });
    }

    if (data.state === 'warEnded' && stateChanged) {
      await this.insertOne({ data, clanTag: tag });
    }

    if (db && !stateChanged) return;

    const endsIn = new Date(moment(data.endTime).toDate()).getTime() - Date.now();
    if (endsIn <= 0 || endsIn <= 10 * 60 * 1000) {
      this.reSchedule(cache, res.maxAge);
      this.newMaxAge(cache, Number(res.maxAge) + 2000);
    }

    const clan = data.clan.tag === tag ? data.clan : data.opponent;
    const opponent = data.clan.tag === tag ? data.opponent : data.clan;

    this.broadcastWar(tag, data, db?.warType ?? 1, db);
    if (this.workerService.has(opponent.tag)) {
      this.broadcastWar(opponent.tag, data, db?.warType ?? 1, db);
    }
    if (['inWar', 'warEnded'].includes(data.state) && db) {
      await this.updateLastSeen(clan, db);
      if (this.workerService.has(opponent.tag)) {
        await this.updateLastSeen(opponent, db);
      }
    }
  }

  private async fetchWithWarTag(warTag: string) {
    const { body, res } = await this.clashClient.getClanWarLeagueRound(warTag);
    return { body, res, warTag };
  }

  // Fetch Clan War League Rounds [CWL]
  private async getClanWarLeagueGroups(tag: string, cache: Cache) {
    // The current CWL season can no longer be derived from the clock (the API season is an
    // unpredictable YYYY-MM-DD, and there can be more than one CWL per month). Probe the clan's
    // most recent stored group and reuse it ONLY while that CWL is still active — i.e. it still
    // has a war yet to start (`next` in the future). A finished or previous-season group has
    // `next` in the past, so it is never reused; we fall through to the live API and operate
    // strictly on the current season below.
    const cached = await this.db
      .collection(Collections.CWL_GROUPS)
      .findOne({ 'clans.tag': tag }, { sort: { _id: -1 } });

    if (cached && cached.next >= Date.now()) {
      return this.getClanWarLeagueRounds(tag, cache, cached.rounds, cached);
    }

    const { body, res } = await this.clashClient.getClanWarLeagueGroup(tag);
    if (!res.ok || body.state === 'notInWar') {
      this.newMaxAge(cache, res.maxAge);
      return;
    }

    const rounds = body.rounds.filter((round) => !round.warTags.includes('#0'));
    const warTags = body.clans.reduce<{ [key: string]: string[] }>((record, clan) => {
      record[clan.tag] = [];
      return record;
    }, {});

    const times: number[] = [];
    for (const round of rounds) {
      const wars = await Promise.all(round.warTags.map((warTag) => this.fetchWithWarTag(warTag)));
      for (const { body, res, warTag } of wars) {
        if (!res.ok) continue;
        times.push(this.toDate(body.startTime).getTime());
        if (!warTags[body.clan.tag].includes(warTag)) warTags[body.clan.tag].push(warTag);
        if (!warTags[body.opponent.tag].includes(warTag)) warTags[body.opponent.tag].push(warTag);
      }
    }

    const uid = this.md5(
      `${body.season}-${body.clans
        .map((clan) => clan.tag)
        .sort((a, b) => a.localeCompare(b))
        .join('-')}`,
    );

    // Reuse leagues/clans from *this* season's own stored doc (matched by uid) to avoid
    // recomputing them; computed fresh only the first time this CWL is seen.
    const existing = await this.db.collection(Collections.CWL_GROUPS).findOne({ uid });
    const { leagues, clans } = existing
      ? { clans: existing.clans, leagues: existing.leagues }
      : await this.leagueIds(body.clans);
    if (clans.length !== body.clans.length) return null;

    const value = await this.db.collection(Collections.CWL_GROUPS).findOneAndUpdate(
      { uid },
      {
        $set: { rounds, warTags, next: Math.max(...times) },
        $setOnInsert: {
          uid,
          season: body.season,
          id: await this.getLeagueGroupId(),
          clans,
          leagues,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    return this.getClanWarLeagueRounds(tag, cache, value!.rounds, value!);
  }

  private async leagueIds(_clans: { tag: string }[]) {
    const clans = (await Promise.all(_clans.map((clan) => this.clashClient.getClan(clan.tag))))
      .filter(({ res }) => res.ok)
      .map(({ body }) => {
        const leagueId = body.warLeague?.id ?? UNRANKED_WAR_LEAGUE_ID;
        return { name: body.name, tag: body.tag, leagueId };
      });

    const leagues = clans.reduce<Record<string, number>>((acc, curr) => {
      acc[curr.tag] = curr.leagueId;
      return acc;
    }, {});

    return { clans, leagues };
  }

  private md5(id: string) {
    return createHash('md5').update(id).digest('hex');
  }

  // For Clan-War-Leagues [CWL]
  private async getClanWarLeagueRounds(
    tag: string,
    cache: Cache,
    rounds: { warTags: string[] }[],
    value: WithId<CWLGroupsEntity>,
  ) {
    const lastWarTag =
      rounds.length === value.clans.length - 1 ? value.warTags[tag].slice(-1).at(0) : null;
    for (const warTag of value.warTags[tag]) {
      const ended = await this.db.collection(Collections.CLAN_WARS).findOne({
        warTag,
        state: 'warEnded',
        $or: [{ 'clan.tag': tag }, { 'opponent.tag': tag }],
      });
      if (warTag === lastWarTag && ended) {
        const key = `CWL_GROUP_ENDED:${value.uid}`;
        const endedList = await this.redis.smembers(key);

        if (this.workerService.has(ended.clan.tag) && !endedList.includes(ended.clan.tag)) {
          this.broadcastCWL(ended.clan.tag, ended, value.clans.length - 1, warTag, ended, true);
        }
        if (this.workerService.has(ended.opponent.tag) && !endedList.includes(ended.opponent.tag)) {
          this.broadcastCWL(ended.opponent.tag, ended, value.clans.length - 1, warTag, ended, true);
        }

        await this.redis
          .multi()
          .sadd(key, [ended.clan.tag, ended.opponent.tag])
          .expire(key, 60 * 60 * 24 * 3)
          .exec();

        return;
      }
      if (ended) continue;

      const round = rounds.findIndex((round) => round.warTags.includes(warTag)) + 1;
      const { body, res } = await this.clashClient.getClanWarLeagueRound(warTag);
      this.newMaxAge(cache, res.maxAge);

      if (!res.ok) continue;
      if (body.state === 'notInWar') continue;

      const db = await this.db
        .collection(Collections.CLAN_WARS)
        .findOne({ uid: this.createId(body) });

      if (db?.state !== 'warEnded')
        await this.insertOne({ data: body, warTag, leagueGroupId: value.id, clanTag: tag });
      if (db?.state && !this.warStateUpdated(db, body, true)) continue;

      const clan = body.clan.tag === tag ? body.clan : body.opponent;
      const opponent = body.clan.tag === tag ? body.opponent : body.clan;

      this.broadcastCWL(tag, body, round, warTag, db);
      if (this.workerService.has(opponent.tag)) {
        this.broadcastCWL(opponent.tag, body, round, warTag, db);
      }
      if (['inWar', 'warEnded'].includes(body.state) && db) {
        await this.updateLastSeen(clan, db);
        if (this.workerService.has(opponent.tag)) {
          await this.updateLastSeen(opponent, db);
        }
      }
    }
  }

  private broadcastCWL(
    tag: string,
    data: APIClanWar | ClanWarsEntity,
    round: number,
    warTag: string,
    oldWar?: ClanWarsEntity | null,
    ended?: boolean,
  ) {
    const clan = data.clan.tag === tag ? data.clan : data.opponent;
    const opponent = data.clan.tag === clan.tag ? data.opponent : data.clan;
    clan.members
      .sort((a, b) => a.mapPosition - b.mapPosition)
      .forEach((member, idx) => (member.mapPosition = idx + 1));
    opponent.members
      .sort((a, b) => a.mapPosition - b.mapPosition)
      .forEach((member, idx) => (member.mapPosition = idx + 1));

    const replacedMembers =
      oldWar && data.state === 'preparation'
        ? this.replacedRosters(
            oldWar.clan.tag === tag ? oldWar.clan.members : oldWar.opponent.members,
            clan.members,
          )
        : null;
    const newAttacks =
      oldWar && oldWar.state === 'inWar'
        ? this.findNewAttacks(
            oldWar.clan.tag === tag ? oldWar.clan.members : oldWar.opponent.members,
            clan.members,
            opponent.members,
            clan.tag,
          )
        : [];

    const newDefenses =
      oldWar && oldWar.state === 'inWar'
        ? this.findNewAttacks(
            oldWar.clan.tag === tag ? oldWar.opponent.members : oldWar.clan.members,
            opponent.members,
            clan.members,
            opponent.tag,
          )
        : [];

    const warData = {
      op: Flags.CLAN_WAR_LOG,
      id: oldWar?.id ?? null,
      tag,
      warType: WarType.CWL,
      round,
      warTag,
      uid: this.createId(data),
      teamSize: data.teamSize || data.clan.members.length,
      attacksPerMember: 1,
      state: data.state,
      startTime: data.startTime,
      endTime: data.endTime,
      clan: {
        name: clan.name,
        tag: clan.tag,
        badgeUrls: {
          small: clan.badgeUrls.small,
        },
        stars: clan.stars,
        destructionPercentage: clan.destructionPercentage,
        attacks: clan.attacks,
        rosters: this.roster(clan.members),
      },
      opponent: {
        name: opponent.name,
        tag: opponent.tag,
        badgeUrls: {
          small: opponent.badgeUrls.small,
        },
        stars: opponent.stars,
        destructionPercentage: opponent.destructionPercentage,
        attacks: opponent.attacks,
        rosters: this.roster(opponent.members),
      },
      remaining: data.state === 'warEnded' ? clan.members.filter((m) => !m.attacks) : [],
      recent: data.state === 'inWar' ? this.getRecentAttacks(clan, opponent) : [],
      result: data.state === 'warEnded' ? this.getWarResult(clan, opponent) : null,
      members: [
        ...clan.members.map((m) => ({ tag: m.tag, op: 'WAR' })),
        ...(replacedMembers?.oldMembers ?? []).map((m) => ({ tag: m.tag, op: 'WAR_REMOVED' })),
      ],
      newAttacks,
      newDefenses,
      oldMembers: replacedMembers?.oldMembers ?? [],
      newMembers: replacedMembers?.newMembers ?? [],
      type: ended ? 'CWL_ENDED' : 'WAR_UPDATED',
    };
    this.eventEmitter.emit(WorkerEvents.WAR_UPSTREAM, warData);
  }

  private broadcastWar(
    tag: string,
    data: APIClanWar,
    warType: number,
    oldWar?: ClanWarsEntity | null,
  ) {
    const clan = data.clan.tag === tag ? data.clan : data.opponent;
    const opponent = data.clan.tag === clan.tag ? data.opponent : data.clan;

    const newAttacks =
      oldWar && data.state === 'inWar'
        ? this.findNewAttacks(
            oldWar.clan.tag === tag ? oldWar.clan.members : oldWar.opponent.members,
            clan.members,
            opponent.members,
            clan.tag,
          )
        : [];

    const newDefenses =
      oldWar && data.state === 'inWar'
        ? this.findNewAttacks(
            oldWar.clan.tag === tag ? oldWar.opponent.members : oldWar.clan.members,
            opponent.members,
            clan.members,
            opponent.tag,
          )
        : [];

    const warData = {
      op: Flags.CLAN_WAR_LOG,
      tag,
      id: oldWar?.id ?? null,
      warType,
      teamSize: data.teamSize || data.clan.members.length,
      state: data.state,
      uid: this.createId(data),
      startTime: data.startTime,
      endTime: data.endTime,
      attacksPerMember: data.attacksPerMember ?? 2,
      clan: {
        name: clan.name,
        tag: clan.tag,
        badgeUrls: {
          small: clan.badgeUrls.small,
        },
        stars: clan.stars,
        destructionPercentage: clan.destructionPercentage,
        attacks: clan.attacks,
        rosters: this.roster(clan.members),
      },
      opponent: {
        name: opponent.name,
        tag: opponent.tag,
        badgeUrls: {
          small: opponent.badgeUrls.small,
        },
        stars: opponent.stars,
        destructionPercentage: opponent.destructionPercentage,
        attacks: opponent.attacks,
        rosters: this.roster(opponent.members),
      },
      remaining:
        data.state === 'warEnded' ? clan.members.filter((m) => m.attacks?.length !== 2) : [],
      recent: data.state === 'inWar' ? this.getRecentAttacks(clan, opponent) : [],
      result: data.state === 'warEnded' ? this.getWarResult(clan, opponent) : null,
      newAttacks,
      newDefenses,
      members: [...clan.members.map((m) => ({ tag: m.tag, op: 'WAR' }))],
    };

    this.eventEmitter.emit(WorkerEvents.WAR_UPSTREAM, warData);
  }

  private async broadcastMissed(tag: string, warType: number, data: any) {
    const clan = data.clan.tag === tag ? data.clan : data.opponent;
    const opponent = data.clan.tag === tag ? data.opponent : data.clan;

    this.broadcastWar(tag, { ...data, state: 'warEnded' }, warType, data.id);
    if (this.workerService.has(opponent.tag)) {
      this.broadcastWar(opponent.tag, { ...data, state: 'warEnded' }, warType, data.id);
    }

    await this.collection.updateOne(
      { uid: data.uid },
      { $set: { state: 'warEnded', updatedAt: new Date() } },
    );

    await this.redis
      .multi()
      .del(`WAR_UID:${clan.tag as string}`)
      .del(`WAR_UID:${opponent.tag as string}`)
      .exec();
  }

  private async updateLastSeen(clan: APIWarClan, data: any) {
    const oldMembers: APIClanWarMember[] =
      data?.clan.tag === clan.tag ? data.clan.members : data.opponent.members;

    const seasonId = Season.ID;
    const collection = this.db.collection(Collections.PLAYERS);
    const ops: AnyBulkWriteOperation<any>[] = [];

    for (const m of clan.members) {
      const prevAttackCount = oldMembers.find((mem) => mem.tag === m.tag)?.attacks?.length ?? 0;
      if (prevAttackCount === (m.attacks?.length ?? 0)) continue;
      const $set = {
        name: m.name,
        tag: m.tag,
        clan: {
          tag: clan.tag,
          name: clan.name,
        },
        lastSeen: new Date(),
      };
      ops.push({
        updateOne: {
          filter: { tag: m.tag },
          upsert: true,
          update: { $set, $inc: { [`seasons.${seasonId}`]: 1 } },
        },
      });
      this.bulkWriter.activities.push({
        tag: m.tag,
        timestamp: Math.floor(Date.now() / 1000),
        clanTag: clan.tag,
        action: 'UNKNOWN',
      });
    }
    if (ops.length) await collection.bulkWrite(ops, { ordered: false });
  }

  private reSchedule(cache: Cache, maxAge: number) {
    setTimeout(this.exec.bind(this), maxAge + 1000, cache.tag, cache);
  }

  private getPreviousBestAttack(clan: APIWarClan, defenderTag: string, attackerTag: string) {
    const attacks = clan.members
      .filter(
        (mem): mem is APIClanWarMember & { attacks: APIClanWarAttack[] } => !!mem.attacks?.length,
      )
      .map((mem) => mem.attacks)
      .flat()
      .filter((atk) => atk.defenderTag === defenderTag && atk.attackerTag !== attackerTag)
      .sort((a, b) => b.destructionPercentage ** b.stars - a.destructionPercentage ** a.stars);
    return attacks.at(0);
  }

  private freshAttack(clan: APIWarClan, defenderTag: string, order: number) {
    const attacks = clan.members
      .filter(
        (mem): mem is APIClanWarMember & { attacks: APIClanWarAttack[] } => !!mem.attacks?.length,
      )
      .map((mem) => mem.attacks)
      .flat()
      .filter((atk) => atk.defenderTag === defenderTag)
      .sort((a, b) => a.order - b.order);

    return Boolean(attacks.length === 1 || attacks.at(0)!.order === order);
  }

  private getRecentAttacks(clan: APIWarClan, opponent: APIWarClan) {
    const allAttacks = clan.members.flatMap((mem) => mem.attacks ?? []);

    return allAttacks
      .sort((a, b) => b.order - a.order)
      .slice(0, 4)
      .map((attack) => {
        const previous = getPreviousBestAttack(allAttacks, attack);
        const member = clan.members.find((mem) => mem.tag === attack.attackerTag)!;
        const defender = opponent.members.find((mem) => mem.tag === attack.defenderTag)!;
        return {
          attacker: {
            name: member.name,
            townHallLevel: member.townhallLevel,
            stars: attack.stars,
            oldStars: previous?.stars ?? 0,
            destructionPercentage: attack.destructionPercentage,
            mapPosition: member.mapPosition,
          },
          defender: {
            townHallLevel: defender.townhallLevel,
            mapPosition: defender.mapPosition,
          },
        };
      });
  }

  // Calculates War Result
  private getWarResult(clan: APIWarClan, opponent: APIWarClan) {
    if (clan.stars === opponent.stars) {
      if (clan.destructionPercentage === opponent.destructionPercentage) return 'tied';
      if (clan.destructionPercentage > opponent.destructionPercentage) return 'won';
    }
    if (clan.stars > opponent.stars) return 'won';
    return 'lost';
  }

  // Builds Clan Roster
  private roster(members: APIClanWarMember[] = []) {
    const reduced = members.reduce<Record<string, number>>((count, member) => {
      const townHall = member.townhallLevel;
      count[townHall] = (count[townHall] || 0) + 1;
      return count;
    }, {});

    return Object.entries(reduced)
      .map((entry) => ({ level: Number(entry[0]), total: entry[1] }))
      .sort((a, b) => b.level - a.level);
  }

  private async enqueue(debug = true) {
    if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
      this.logger.debug(`Starting Requests (${this.cached.size} Wars)`);
    }
    const startTime = Date.now();

    try {
      for (const tag of this.cached.keys()) {
        if (this.workerService.isInMaintenance) continue;

        const cache = this.cached.get(tag);
        if (cache?.maxAge && !(Date.now() >= cache.maxAge.getTime())) continue;
        if (cache) await this.exec(tag, cache);
      }

      if (!this.workerService.isInMaintenance) {
        await this.redis.hset(
          RedisKeys.LOOP_TIMINGS,
          RedisKeys.WAR_LOOP,
          JSON.stringify({ timeTaken: Date.now() - startTime, timestamp: Date.now() }),
        );
      }
    } finally {
      const timeTaken = Date.now() - startTime;
      if ((process.env.DEBUG || debug) && !this.workerService.isInMaintenance) {
        this.logger.verbose(`Finished Requests [${formatDuration(timeTaken)}] (Wars)`);
      }

      setTimeout(
        this.enqueue.bind(this),
        (timeTaken >= this.refreshInterval ? 0 : this.refreshInterval - timeTaken) + 10000,
        false,
      );
    }
  }

  @OnEvent(WorkerEvents.CLANS_LOADED)
  public onWorkerInit(clans: WorkerInitDto[]) {
    if (process.env.WAR_TRACKING !== '1') return;

    clans.forEach((data) => {
      const cache = this.cached.get(data.tag) ?? { tag: data.tag };
      this.cached.set(data.tag, cache);
    });

    return this.enqueue();
  }

  @OnEvent(WorkerEvents.CLAN_ADDED)
  public async add(data: { tag: string }) {
    if (process.env.WAR_TRACKING !== '1') return;

    const existing = this.cached.has(data.tag);
    const cache = this.cached.get(data.tag) ?? { tag: data.tag };
    this.cached.set(data.tag, { ...cache, tag: data.tag });
    if (!existing) return this.exec(data.tag, this.cached.get(data.tag)!);
  }

  @OnEvent(WorkerEvents.CLAN_REMOVED)
  public delete(tag: string) {
    return this.cached.delete(tag);
  }

  @OnEvent(WorkerEvents.WAR_UPSTREAM)
  async onUpstreamFeed(data: any) {
    await this.publisher.publish(RedisChannels.UPSTREAM_FEED, JSON.stringify(data));
  }
}
