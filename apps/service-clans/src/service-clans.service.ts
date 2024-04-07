import { ClashClient } from '@app/clash-client';
import { RedisKeyPrefixes, Tokens } from '@app/constants';
import { KAFKA_PRODUCER } from '@app/kafka';
import { MongoDbService, TrackedClanList } from '@app/mongodb';
import { RedisClient, RedisJSON, RedisService, getRedisKey } from '@app/redis';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIClan } from 'clashofclans.js';
import { Producer } from 'kafkajs';
import { ClanChangesOutput, ClanMemberChangesOutput } from './dto';

enum LogType {
  CLAN_LEVEL_CHANGE = 'clan_level_change',
  CLAN_WAR_LEAGUE_CHANGE = 'clan_war_league_change',
  CAPITAL_LEAGUE_CHANGE = 'capital_league_change',
  CLAN_MEMBER_CHANGE = 'clan_member_change',
}

@Injectable()
export class ClansService {
  constructor(
    private configService: ConfigService,
    @Inject(Tokens.REDIS) private redis: RedisClient,
    @Inject(Tokens.CLASH_CLIENT) private clashClient: ClashClient,
    private redisService: RedisService,
    private mongoDbService: MongoDbService,
    @Inject(KAFKA_PRODUCER) private producer: Producer,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  private logger = new Logger(ClansService.name);
  private cached = new Map<string, TrackedClanList>();
  private pollingInterval = 1 * 60 * 1000; // 1 minute

  protected onApplicationBootstrap() {
    const disabled = this.configService.get('SERVICE_WARS_DISABLED');
    if (!disabled) this.init(); // Start polling from the API
  }

  private async init() {
    this.logger.debug('Loading clans...');
    await this.loadClans();

    this.logger.debug('Start polling...');
    await this.startPolling();
  }

  private async loadClans() {
    const clans = await this.mongoDbService.getTrackedClans();
    this.logger.debug(`${clans.length} clans loaded`);

    for (const clan of clans) this.cached.set(clan.tag, clan);
  }

  private async startPolling() {
    const _start = Date.now();
    try {
      for (const clanTag of this.cached.keys()) {
        await this.fetchClan(clanTag);
      }
    } finally {
      this.logger.debug(`Time Elapsed: ${Date.now() - _start}ms`);
      setTimeout(() => this.startPolling.bind(this), this.pollingInterval).unref();
    }
  }

  private async fetchClan(clanTag: string) {
    const [{ body: clan, res }, cached] = await Promise.all([
      this.clashClient.getClan(clanTag),
      this.redisService.getClan(clanTag),
    ]);

    if (!res.ok || !clan) return null; // TODO: Freeze deleted clans

    if (cached) this._clanDiff(cached, clan);
    if (cached) this._clanMemberDiff(cached, clan);

    return this.updateCache(clan);
  }

  public publish(logType: LogType, payload: unknown) {
    const value = JSON.stringify(payload);
    return this.producer.send({ topic: logType, messages: [{ value }] });
  }

  private _clanDiff(cached: APIClan, clan: APIClan) {
    const payload: ClanChangesOutput = {
      name: clan.name,
      tag: clan.tag,
      clanLevel: clan.clanLevel,
      warLeague: clan.warLeague,
      capitalLeague: clan.capitalLeague,
      oldCapitalLeague: cached.capitalLeague,
      oldWarLeague: cached.warLeague,
    };

    // CLAN LEVEL CHANGE
    if (cached.clanLevel !== clan.clanLevel) {
      this.publish(LogType.CLAN_LEVEL_CHANGE, payload);
    }

    // CAPITAL LEAGUE CHANGE
    if (
      cached.capitalLeague &&
      clan.capitalLeague &&
      cached.capitalLeague.id !== clan.capitalLeague.id
    ) {
      this.publish(LogType.CAPITAL_LEAGUE_CHANGE, payload);
    }

    // WAR LEAGUE CHANGE
    if (cached.warLeague && clan.warLeague && cached.warLeague.id !== clan.warLeague.id) {
      this.publish(LogType.CLAN_WAR_LEAGUE_CHANGE, payload);
    }
  }

  private _clanMemberDiff(cached: APIClan, clan: APIClan) {
    const cachedMemberMap = Object.fromEntries(
      cached.memberList.map((member) => [member.tag, member]),
    );
    const clanMemberTags = clan.memberList.map((member) => member.tag);

    const payload: ClanMemberChangesOutput = {
      clan: {
        name: clan.name,
        tag: clan.tag,
        members: clan.members,
        badgeUrls: clan.badgeUrls,
      },
      donationsLog: [],
      donationsReceivedLog: [],
      roleChangeLog: [],
      leagueChangeLog: [],
      nameChangeLog: [],
      legendsLog: [],
      memberJoinedLog: [],
      memberLeftLog: [],
      reJoinedLog: [],
      townHallChangeLog: [],
    };

    for (const member of clan.memberList) {
      const oldMember = cachedMemberMap[member.tag];
      const donations = member.donations - (oldMember?.donations ?? 0);
      const donationsReceived = member.donationsReceived - (oldMember?.donationsReceived ?? 0);

      // DONATIONS CHANGE
      if (donations > 0) {
        payload.donationsLog.push({
          name: member.name,
          tag: member.tag,
          donations,
          townHallLevel: member.townHallLevel,
        });
      }

      // DONATIONS RECEIVED CHANGE
      if (donationsReceived > 0) {
        payload.donationsReceivedLog.push({
          name: member.name,
          tag: member.tag,
          donationsReceived,
          townHallLevel: member.townHallLevel,
        });
      }

      // ROLE CHANGE
      if (oldMember && oldMember.role !== member.role) {
        payload.roleChangeLog.push({
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
          oldRole: oldMember.role,
          role: member.role,
        });
      }

      // TOWN HALL CHANGE
      if (oldMember && oldMember.townHallLevel !== member.townHallLevel) {
        payload.townHallChangeLog.push({
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
        });
      }

      // NAME CHANGE
      if (oldMember && oldMember.name !== member.name) {
        payload.nameChangeLog.push({
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
          oldName: oldMember.name,
        });
      }

      // LEAGUE CHANGE
      if (
        oldMember &&
        oldMember.league?.id &&
        member.league?.id &&
        member.league.id !== oldMember.league.id
      ) {
        payload.leagueChangeLog.push({
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
          oldLeague: oldMember.league,
          league: oldMember.league,
        });
      }

      // LEGEND LOG
      if (oldMember && member.league.id === 29000022 && member.trophies !== oldMember.trophies) {
        payload.legendsLog.push({
          name: member.name,
          tag: member.tag,
          oldTrophies: oldMember.trophies,
          trophies: member.trophies,
          trophiesGained: member.trophies - oldMember.trophies,
          timestamp: Date.now(),
        });
      }

      // REJOINED LOG
      if (
        oldMember &&
        (member.donations < oldMember.donations ||
          member.donationsReceived < oldMember.donationsReceived)
        // !Season.ending // TODO
      ) {
        payload.reJoinedLog.push({
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
          donations: oldMember.donations,
          donationsReceived: oldMember.donationsReceived,
        });
      }

      // MEMBERS JOINED
      if (!oldMember) {
        payload.memberLeftLog.push({
          name: member.name,
          tag: member.tag,
          townHallLevel: member.townHallLevel,
        });
      }
    }

    // MEMBERS LEFT
    for (const oldMember of cached.memberList.filter(
      (oldMember) => !clanMemberTags.includes(oldMember.tag),
    )) {
      payload.memberLeftLog.push({
        name: oldMember.name,
        tag: oldMember.tag,
        townHallLevel: oldMember.townHallLevel,
      });
    }

    return payload;
  }

  private updateCache(clan: APIClan) {
    const multi = this.redis.multi();

    const key = getRedisKey(RedisKeyPrefixes.CLAN, clan.tag);
    multi.json.set(key, '$', clan as unknown as RedisJSON);
    multi.expire(key, 6 * 60 * 60);

    return multi.exec();
  }
}
