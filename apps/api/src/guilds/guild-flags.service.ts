import { ClashClientService } from '@app/clash-client';
import { DiscordRestService } from '@app/discord-rest';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db, ObjectId, WithId } from 'mongodb';
import { Collections, FlagsEntity, MONGODB_TOKEN } from '../db';
import { FlagDto, FlagInput, FlagsDto, FlagType } from './dto';

// Servers that aren't supporters can keep this many active flags, as in `/flag create`.
const FLAG_LIMIT = 1000;
const DAY = 24 * 60 * 60 * 1000;

const fixTag = (tag: string) => `#${tag.trim().toUpperCase().replace(/^#/, '').replace(/O/g, '0')}`;
const active = () => ({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] });

// The bot escapes Discord markdown in reasons; the API stores them the same way and shows them plain.
const escapeMarkdown = (text: string) => text.replace(/([\\`*_~|>])/g, '\\$1');
const unescapeMarkdown = (text: string) => text.replace(/\\([\\`*_~|>])/g, '$1');

/** Bans and strikes as `/flag` stores them; the bot reads them fresh when a flagged player joins. */
@Injectable()
export class GuildFlagsService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly clashClientService: ClashClientService,
    private readonly discordRest: DiscordRestService,
  ) {}

  async list(guildId: string, flagType?: FlagType): Promise<FlagsDto> {
    const [flags, total, patron] = await Promise.all([
      this.flags
        .find({ guild: guildId, ...(flagType ? { flagType } : {}), ...active() })
        .sort({ _id: -1 })
        .toArray(),
      this.flags.countDocuments({ guild: guildId, ...active() }),
      this.isPatron(guildId),
    ]);
    return { items: flags.map(toDto), total, limit: patron ? null : FLAG_LIMIT };
  }

  async create(input: { guildId: string; userId: string; body: FlagInput }): Promise<FlagDto[]> {
    const { guildId, body } = input;
    const [total, patron] = await Promise.all([
      this.flags.countDocuments({ guild: guildId, ...active() }),
      this.isPatron(guildId),
    ]);
    if (total >= FLAG_LIMIT && !patron) {
      throw new ForbiddenException(
        `This server has ${FLAG_LIMIT} active flags, the most it can have without supporting ClashPerk.`,
      );
    }

    const tags = [...new Set(body.playerTags.map(fixTag))];
    const players = await this.clashClientService.getPlayers(tags);
    if (!players.length) throw new NotFoundException('No players have those tags.');

    const author = await this.discordRest.getUser(input.userId);
    const now = new Date();
    const flags: WithId<FlagsEntity>[] = players.map((player) => ({
      _id: new ObjectId(),
      guild: guildId,
      user: author.id,
      flagType: body.flagType,
      username: author.username,
      displayName: author.global_name ?? author.username,
      discriminator: author.discriminator,
      tag: player.tag,
      name: player.name,
      flagImpact: body.flagImpact ?? 1,
      reason: escapeMarkdown(body.reason),
      expiresAt: body.expiresInDays ? new Date(now.getTime() + body.expiresInDays * DAY) : null,
      createdAt: now,
    }));
    await this.flags.insertMany(flags);
    return flags.map(toDto);
  }

  /** Only active flags can be removed, as in `/flag delete`. */
  async delete(input: { guildId: string; flagId: string }) {
    const { deletedCount } = ObjectId.isValid(input.flagId)
      ? await this.flags.deleteOne({
          _id: new ObjectId(input.flagId),
          guild: input.guildId,
          ...active(),
        })
      : { deletedCount: 0 };
    if (!deletedCount) throw new NotFoundException('That flag is gone or has expired.');
  }

  private async isPatron(guildId: string) {
    const patron = await this.db
      .collection(Collections.PATRONS)
      .findOne({ 'active': true, 'guilds.id': guildId }, { projection: { _id: 1 } });
    return !!patron;
  }

  private get flags() {
    return this.db.collection<FlagsEntity>(Collections.FLAGS);
  }
}

function toDto(flag: WithId<FlagsEntity>): FlagDto {
  const id = flag._id.toHexString();
  return {
    id,
    refId: id.slice(-5).toUpperCase(),
    flagType: flag.flagType as FlagType,
    tag: flag.tag,
    name: flag.name,
    flagImpact: flag.flagImpact ?? 1,
    reason: unescapeMarkdown(flag.reason),
    expiresAt: flag.expiresAt ?? null,
    createdAt: flag.createdAt,
    createdBy: {
      id: flag.user,
      username: flag.username,
      displayName: flag.displayName ?? flag.username,
    },
  };
}
