import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN } from '../db';
import { BetaGuildsDto } from './dto/beta-guilds.dto';

@Injectable()
export class BetaService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  async isBeta(guildId: string) {
    return (await this.betaGuilds.countDocuments({ guildId }, { limit: 1 })) > 0;
  }

  async listIds() {
    const guilds = await this.betaGuilds
      .find({}, { projection: { guildId: 1 }, sort: { createdAt: 1 } })
      .toArray();
    return { guildIds: guilds.map((guild) => guild.guildId) };
  }

  async list(): Promise<BetaGuildsDto> {
    const guilds = await this.betaGuilds.find({}, { sort: { createdAt: -1 } }).toArray();
    const known = await this.db
      .collection(Collections.BOT_GUILDS)
      .find(
        { guild: { $in: guilds.map((guild) => guild.guildId) } },
        { projection: { guild: 1, name: 1, iconUrl: 1 } },
      )
      .toArray();
    const byId = new Map(known.map((guild) => [guild.guild as string, guild]));
    return {
      guilds: guilds.map((guild) => ({
        guildId: guild.guildId,
        name: (byId.get(guild.guildId)?.name as string | undefined) ?? null,
        iconUrl: (byId.get(guild.guildId)?.iconUrl as string | undefined) ?? null,
        note: guild.note ?? null,
        addedBy: guild.addedBy,
        createdAt: guild.createdAt,
      })),
    };
  }

  /** Servers already in the list keep their note and who added them. */
  async add(input: { guildIds: string[]; note: string | null; addedBy: string }) {
    const now = new Date();
    await this.betaGuilds.bulkWrite(
      [...new Set(input.guildIds)].map((guildId) => ({
        updateOne: {
          filter: { guildId },
          update: {
            $setOnInsert: { guildId, note: input.note, addedBy: input.addedBy, createdAt: now },
          },
          upsert: true,
        },
      })),
    );
    return this.list();
  }

  async remove(guildId: string) {
    const { deletedCount } = await this.betaGuilds.deleteOne({ guildId });
    if (!deletedCount) throw new NotFoundException('That server is not in beta.');
    return this.list();
  }

  private get betaGuilds() {
    return this.db.collection(Collections.BETA_GUILDS);
  }
}
