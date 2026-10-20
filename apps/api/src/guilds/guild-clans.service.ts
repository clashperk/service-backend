import { ClashClientService } from '@app/clash-client';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { APIClan } from 'clashofclans.js';
import { Db, ObjectId } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { AddGuildClanInput, GuildClansDto } from './dto';
import { GuildDiscordService } from './guild-discord.service';
import { GuildsService } from './guilds.service';
import { SCHEDULE_COLLECTIONS } from './reminder-schedules.service';

const REMINDER_COLLECTIONS = {
  clanWars: Collections.CLAN_WAR_REMINDERS,
  capitalRaids: Collections.CAPITAL_RAID_REMINDERS,
  clanGames: Collections.CLAN_GAMES_REMINDERS,
} as const;

// A clan added to more servers than this needs verifying wherever it's added next.
const MAX_SHARED_SERVERS = 10;

const fixTag = (tag: string) => `#${tag.toUpperCase().replace(/^#/, '').replace(/O/g, '0')}`;
const categoryKey = (name: string) => name.toLowerCase().trim().replace(/\s+/g, '_');

/** Smaller servers ask for verification sooner. */
const clanLimit = (memberCount: number) => (memberCount < 50 ? 5 : memberCount < 100 ? 20 : 100);

/** Adding and removing a server's clans and categories, as `/setup clan` and `/category` do. */
@Injectable()
export class GuildClansService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly clashClientService: ClashClientService,
    private readonly discord: GuildDiscordService,
    private readonly guilds: GuildsService,
  ) {}

  async add(input: {
    guildId: string;
    userId: string;
    applicationId: string | null;
    body: AddGuildClanInput;
  }): Promise<GuildClansDto> {
    const { guildId, body } = input;
    const clan = await this.clashClientService.getClan(fixTag(body.tag));
    if (!clan) throw new NotFoundException('No clan has that tag.');

    const categoryId = body.categoryId ? new ObjectId(body.categoryId) : null;
    if (categoryId && !(await this.categories.findOne({ _id: categoryId, guildId }))) {
      throw new NotFoundException('That category is not in this server.');
    }

    const [existing, total, elsewhere, last, patron] = await Promise.all([
      this.clans.findOne({ guild: guildId, tag: clan.tag }),
      this.clans.countDocuments({ guild: guildId }),
      this.clans.findOne({ tag: clan.tag, guild: { $ne: guildId } }),
      this.clans.find({}, { sort: { uniqueId: -1 }, limit: 1, projection: { uniqueId: 1 } }).next(),
      this.isPatron(guildId),
    ]);
    if (!existing?.verified && !patron) {
      await this.checkVerification({ ...input, clan, total, existing: !!existing });
    }

    await this.clans.updateOne(
      { guild: guildId, tag: clan.tag },
      {
        $set: {
          name: clan.name,
          tag: clan.tag,
          guild: guildId,
          paused: false,
          active: true,
          verified: true,
          order: existing?.order ?? total + 1,
          patron,
          ...(categoryId ? { categoryId } : {}),
        },
        $setOnInsert: {
          // The tracker keys a clan by this ID, so every server shares the first one it got.
          uniqueId: elsewhere?.uniqueId ?? (last?.uniqueId ?? 1000) + 1,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
    return this.guilds.getGuildClans(guildId);
  }

  /** Also removes its logs and takes it off reminders, deleting reminders left with no clans. */
  async remove(input: { guildId: string; clanTag: string }): Promise<GuildClansDto> {
    const { guildId } = input;
    const clan = await this.clans.findOne({ guild: guildId, tag: fixTag(input.clanTag) });
    if (!clan) throw new NotFoundException('That clan is not added to this server.');

    for (const [kind, collection] of Object.entries(REMINDER_COLLECTIONS)) {
      const reminders = this.db.collection(collection);
      await reminders.deleteMany({ guild: guildId, clans: [clan.tag] });
      await reminders.updateMany(
        { guild: guildId, clans: clan.tag },
        { $pull: { clans: clan.tag } },
      );
      await this.db
        .collection(SCHEDULE_COLLECTIONS[kind as keyof typeof SCHEDULE_COLLECTIONS])
        .deleteMany({ guild: guildId, tag: clan.tag });
    }
    await this.db.collection(Collections.CLAN_LOGS).deleteMany({ clanId: clan._id });
    // Last, so the bot stops tracking the clan only once nothing points at it.
    await this.clans.deleteOne({ _id: clan._id });
    return this.guilds.getGuildClans(guildId);
  }

  async createCategory(guildId: string, name: string): Promise<GuildClansDto> {
    await this.checkCategoryName(guildId, name);
    const last = await this.categories.findOne({ guildId }, { sort: { order: -1 } });
    await this.categories.insertOne({
      guildId,
      name: categoryKey(name),
      displayName: name.trim(),
      order: (last?.order ?? 0) + 1,
    });
    return this.guilds.getGuildClans(guildId);
  }

  async renameCategory(guildId: string, categoryId: string, name: string): Promise<GuildClansDto> {
    const _id = this.toCategoryId(categoryId);
    await this.checkCategoryName(guildId, name, _id);
    const { matchedCount } = await this.categories.updateOne(
      { _id, guildId },
      { $set: { name: categoryKey(name), displayName: name.trim() } },
    );
    if (!matchedCount) throw new NotFoundException('That category is not in this server.');
    return this.guilds.getGuildClans(guildId);
  }

  /** Its clans move to Uncategorized. */
  async deleteCategory(guildId: string, categoryId: string): Promise<GuildClansDto> {
    const _id = this.toCategoryId(categoryId);
    const { deletedCount } = await this.categories.deleteOne({ _id, guildId });
    if (!deletedCount) throw new NotFoundException('That category is not in this server.');
    await this.clans.updateMany(
      { guild: guildId, categoryId: _id },
      { $set: { categoryId: null } },
    );
    return this.guilds.getGuildClans(guildId);
  }

  /**
   * The bot asks for proof of leadership once a server has many clans, or the clan is in many
   * servers: a verified Leader or Co-Leader account, or `CP` plus the server ID's last two digits
   * in the clan description.
   */
  private async checkVerification(input: {
    guildId: string;
    userId: string;
    applicationId: string | null;
    clan: APIClan;
    total: number;
    existing: boolean;
  }) {
    const { guildId, clan } = input;
    const [memberCount, servers] = await Promise.all([
      this.discord.memberCount(guildId, input.applicationId),
      this.clans.countDocuments({ tag: clan.tag, guild: { $ne: guildId } }),
    ]);
    const limit = input.existing ? 100 : clanLimit(memberCount);
    if (servers <= MAX_SHARED_SERVERS && input.total < limit) return;

    const code = `CP${guildId.slice(-2)}`;
    if (clan.description?.toUpperCase().includes(code)) return;
    const leaders = clan.memberList
      .filter((member) => member.role === 'leader' || member.role === 'coLeader')
      .map((member) => member.tag);
    const verifiedLeader = await this.db.collection(Collections.PLAYER_LINKS).findOne({
      userId: input.userId,
      tag: { $in: leaders },
      verified: true,
      deleted: { $ne: true },
    });
    if (verifiedLeader) return;

    throw new ForbiddenException(
      `This clan needs verifying first. Put ${code} in its description in the game, or verify a Leader or Co-Leader account you've linked, then try again.`,
    );
  }

  private async checkCategoryName(guildId: string, name: string, exceptId?: ObjectId) {
    const taken = await this.categories.findOne({
      guildId,
      name: categoryKey(name),
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    });
    if (taken) throw new ConflictException('A category with this name already exists.');
  }

  private toCategoryId(categoryId: string) {
    if (!ObjectId.isValid(categoryId)) {
      throw new NotFoundException('That category is not in this server.');
    }
    return new ObjectId(categoryId);
  }

  private async isPatron(guildId: string) {
    const patron = await this.db
      .collection(Collections.PATRONS)
      .findOne({ 'active': true, 'guilds.id': guildId }, { projection: { _id: 1 } });
    return !!patron;
  }

  private get clans() {
    return this.db.collection(Collections.CLAN_STORES);
  }

  private get categories() {
    return this.db.collection(Collections.CLAN_CATEGORIES);
  }
}
