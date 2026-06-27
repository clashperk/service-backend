import { UNRANKED_TIER, WorkerEvents } from '@app/constants';
import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Db, ObjectId } from 'mongodb';
import { CLICKHOUSE_TOKEN, Collections, GLOBAL_MONGODB_TOKEN } from '../db';

@Injectable()
export class BulkWriterService {
  private logger = new Logger(BulkWriterService.name);

  public activities: PlayerActivityRecord[] = [];
  public donations: DonationRecord[] = [];
  public playerProgress: PlayerTroopsRecord[] = [];
  public trophyChanges: TrophyChangeRecord[] = [];

  public constructor(
    @Inject(GLOBAL_MONGODB_TOKEN) private db: Db,
    @Inject(CLICKHOUSE_TOKEN) private clickhouse: ClickHouseClient,
  ) {}

  @OnEvent(WorkerEvents.WORKER_STARTED)
  public async init() {
    await this.writePlayerActivities();
    await this.writeDonationActivities();
    await this.writeUnitActivities();
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { waitForCompletion: true })
  async writePlayerActivities(force = false) {
    if (!(this.activities.length >= (force ? 1 : 1000))) return;

    const values = this.activities;
    this.activities = [];

    const startTime = Date.now();
    await this.clickhouse.insert({
      table: 'player_activities',
      format: 'JSONEachRow',
      values,
    });
    this.logger.log(`Clickhouse took (${values.length}) ${Date.now() - startTime}ms`);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { waitForCompletion: true })
  async writeDonationActivities(force = false) {
    if (!(this.donations.length >= (force ? 1 : 500))) return;

    const values = this.donations;
    this.donations = [];

    const startTime = Date.now();
    await this.clickhouse.insert<DonationRecord>({
      table: 'donation_records',
      format: 'JSONEachRow',
      values,
    });
    this.logger.log(`Clickhouse took (${values.length}) ${Date.now() - startTime}ms`);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { waitForCompletion: true })
  async writeTrophyChangeRecords(force = false) {
    if (!(this.trophyChanges.length >= (force ? 1 : 500))) return;

    const values = this.trophyChanges;
    this.trophyChanges = [];

    const startTime = Date.now();
    await this.clickhouse.insert<TrophyChangeRecord>({
      table: 'player_trophy_records',
      format: 'JSONEachRow',
      values,
    });
    this.logger.log(`Clickhouse took (${values.length}) ${Date.now() - startTime}ms`);
  }

  @Cron(CronExpression.EVERY_10_SECONDS, { waitForCompletion: true })
  async writeUnitActivities(force = false) {
    if (!(this.playerProgress.length >= (force ? 1 : 500))) return;

    const values = this.playerProgress;
    this.playerProgress = [];

    const startTime = Date.now();
    await this.clickhouse.insert<PlayerTroopsRecord>({
      table: 'player_unit_activities',
      format: 'JSONEachRow',
      values,
    });
    this.logger.log(`Clickhouse took (${values.length}) ${Date.now() - startTime}ms`);
  }

  async reSyncClanHistory(player: {
    tag: string;
    name: string;
    townHallLevel: number;
    trophies: number;
    donations: number;
    attackWins: number;
    leagueTier?: { id: number };
    clan?: { tag: string; name: string; clanLevel: number };
  }) {
    const entity = await this.db
      .collection(Collections.GLOBAL_PLAYERS)
      .findOne({ tag: player.tag });

    const clanTag = player.clan?.tag ?? '#00000';
    const trackingId = entity && entity.clanTag === clanTag ? entity.trackingId : new ObjectId();

    if (!entity || entity.clanTag !== clanTag) {
      await this.db.collection(Collections.GLOBAL_PLAYERS).updateOne(
        { tag: player.tag },
        {
          $setOnInsert: {
            createdAt: new Date(),
          },
          $set: {
            name: player.name,
            townHall: player.townHallLevel,
            trophies: player.trophies,
            donations: player.donations,
            attackWins: player.attackWins,
            leagueId: player.leagueTier?.id ?? UNRANKED_TIER,
            clanTag,
            trackingId,
          },
        },
        {
          upsert: true,
        },
      );
    }

    await this.db.collection(Collections.GLOBAL_CLAN_HISTORY).updateOne(
      { playerTag: player.tag, trackingId },
      {
        $setOnInsert: {
          firstSeen: new Date(),
        },
        $set: {
          clanTag,
          lastSeen: new Date(),
        },
      },
      {
        upsert: true,
      },
    );

    if (!player.clan) return;

    await this.db.collection(Collections.GLOBAL_CLANS).updateOne(
      {
        tag: clanTag,
      },
      {
        $setOnInsert: {
          createdAt: new Date(),
          teamSize: 0,
        },
        $set: {
          name: player.clan.name,
          level: player.clan.clanLevel,
        },
      },
      {
        upsert: true,
      },
    );
  }
}

export interface DonationRecord {
  name: string;
  tag: string;
  value: number;
  action: string;
  clan: string;
  clanTag: string;
  createdAt: number;
}

export interface TrophyChangeRecord {
  name: string;
  tag: string;
  leagueId: number;
  trophies: number;
  diff: number;
  attacks: number;
  defenses: number;
  weekId: string;
  createdAt: number;
}

export interface PlayerTroopsRecord {
  name: string;
  tag: string;
  unit: string;
  type: string;
  value: number;
  action: 'UNLOCK' | 'UPGRADE' | 'BOOST';
  createdAt: number;
}

export interface PlayerActivityRecord {
  tag: string;
  clanTag: string;
  timestamp: number;
  action: 'OPTED_IN' | 'OPTED_OUT' | 'LEFT_CLAN' | 'JOINED_CLAN' | 'UNKNOWN';
}
