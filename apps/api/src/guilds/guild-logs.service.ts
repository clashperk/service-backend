import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db, WithId } from 'mongodb';
import { ClanLogsEntity, Collections, MONGODB_TOKEN } from '../db';
import { ClanLogDto, ClanLogInput, ClanLogLimitDto, ClanLogType } from './dto';
import { GuildDiscordService } from './guild-discord.service';

const LOG_TYPES = Object.values(ClanLogType) as string[];
// Links in posts open the game, as `/setup clan-logs` sets them.
const DEEP_LINK = 'OPEN_IN_GAME';
// The bot only posts what happened after a log's last post, so a new log starts 30 minutes back.
const BACKFILL = 30 * 60 * 1000;
// The bot's free limit; Patreon raises it by writing `clanLimit` to Settings.
const DEFAULT_CLAN_LIMIT = 2;
const PATREON_LINK = 'https://www.patreon.com/clashperk';

/** Clan logs written in the bot's format; the bot reloads them when their settings change. */
@Injectable()
export class GuildLogsService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discord: GuildDiscordService,
  ) {}

  async list(input: {
    guildId: string;
    applicationId: string | null;
    clanTag: string;
  }): Promise<ClanLogDto[]> {
    await this.findClanOrThrow(input.guildId, input.clanTag);
    const logs = await this.logs
      .find({ guildId: input.guildId, clanTag: input.clanTag, logType: { $in: LOG_TYPES } })
      .toArray();
    const channelNames = await this.discord.channelNames(
      input.guildId,
      input.applicationId,
      logs.map((log) => log.channelId),
    );
    return logs.map((log) => this.toDto(log, channelNames.get(log.channelId) ?? null));
  }

  async save(input: {
    guildId: string;
    applicationId: string | null;
    clanTag: string;
    logType: ClanLogType;
    body: ClanLogInput;
  }): Promise<ClanLogDto> {
    const { guildId, clanTag, logType, body } = input;
    const clan = await this.findClanOrThrow(guildId, clanTag);
    const existing = await this.logs.findOne({ guildId, clanTag, logType });
    if (!existing) await this.checkLimit(guildId, clanTag);

    const sameChannel = existing?.channelId === body.channelId;
    if (!sameChannel) await this.discord.checkChannel(guildId, input.applicationId, body.channelId);
    if (body.roleId && body.roleId !== existing?.roleId) {
      await this.discord.checkRole(guildId, input.applicationId, body.roleId);
    }
    const webhook =
      sameChannel && !body.webhook
        ? (existing?.webhook ?? null)
        : await this.discord.resolveWebhook(
            guildId,
            input.applicationId,
            body.channelId,
            body.webhook,
          );

    const now = new Date();
    const log = await this.logs.findOneAndUpdate(
      { guildId, clanTag, logType },
      {
        $setOnInsert: { createdAt: now },
        $set: {
          clanId: clan._id,
          isEnabled: body.isEnabled,
          channelId: body.channelId,
          color: body.color ?? null,
          deepLink: DEEP_LINK,
          webhook,
          // A self-updating log starts a new message in a new channel.
          messageId: sameChannel ? (existing?.messageId ?? null) : null,
          updatedAt: now,
          ...(body.roleId ? { roleId: body.roleId } : {}),
        },
        ...(body.roleId ? {} : { $unset: { roleId: true as const } }),
        $min: { lastPostedAt: new Date(now.getTime() - BACKFILL) },
      },
      { upsert: true, returnDocument: 'after' },
    );
    const channelNames = await this.discord.channelNames(guildId, input.applicationId, [
      body.channelId,
    ]);
    return this.toDto(log!, channelNames.get(body.channelId) ?? null);
  }

  async delete(input: { guildId: string; clanTag: string; logType: ClanLogType }) {
    const { deletedCount } = await this.logs.deleteOne({
      guildId: input.guildId,
      clanTag: input.clanTag,
      logType: input.logType,
    });
    if (!deletedCount) throw new NotFoundException('That log is not set up.');
  }

  /** Logs work for up to `limit` clans in a server; any log, on or off, counts its clan. */
  async limit(guildId: string): Promise<ClanLogLimitDto> {
    const [settings, clanIds, patron] = await Promise.all([
      this.db
        .collection(Collections.SETTINGS)
        .findOne({ guildId }, { projection: { clanLimit: 1 } }),
      this.logs.distinct('clanId', { guildId }),
      this.db
        .collection(Collections.PATRONS)
        .findOne({ 'active': true, 'guilds.id': guildId }, { projection: { _id: 1 } }),
    ]);
    // Logs of clans removed from the server don't count, as in the bot.
    const clans = await this.db
      .collection(Collections.CLAN_STORES)
      .find({ _id: { $in: clanIds }, guild: guildId }, { projection: { tag: 1 } })
      .toArray();
    return {
      limit: settings?.clanLimit ?? DEFAULT_CLAN_LIMIT,
      clanTags: clans.map((clan) => clan.tag),
      patron: !!patron,
    };
  }

  private async checkLimit(guildId: string, clanTag: string) {
    const { limit, clanTags, patron } = await this.limit(guildId);
    if (clanTags.includes(clanTag) || clanTags.length < limit) return;
    throw new ForbiddenException(
      patron
        ? `This server has logs for ${limit} clans, its limit. Contact us on Discord to raise it.`
        : `Free servers can have logs for ${limit} clans. Support ClashPerk on Patreon (${PATREON_LINK}) for more, or use /redeem in Discord if you already do.`,
    );
  }

  private async findClanOrThrow(guildId: string, clanTag: string) {
    const clan = await this.db
      .collection(Collections.CLAN_STORES)
      .findOne({ guild: guildId, tag: clanTag }, { projection: { _id: 1 } });
    if (!clan) throw new NotFoundException('That clan is not added to this server.');
    return clan;
  }

  private toDto(log: WithId<ClanLogsEntity>, channelName: string | null): ClanLogDto {
    return {
      id: log._id.toHexString(),
      logType: log.logType as ClanLogType,
      channelId: log.channelId,
      channelName,
      isEnabled: log.isEnabled,
      roleId: log.roleId ?? null,
      color: log.color ?? null,
      updatedAt: log.updatedAt,
    };
  }

  private get logs() {
    return this.db.collection(Collections.CLAN_LOGS);
  }
}
