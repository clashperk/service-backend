import { DiscordOauthService } from '@app/discord-oauth';
import { Inject, Injectable } from '@nestjs/common';
import { AnyBulkWriteOperation, Db, ObjectId } from 'mongodb';
import { ClanCategoriesEntity, ClanStoresEntity, Collections, MONGODB_TOKEN } from '../db';
import { GuildClanDto, ReorderClanCategoriesInput } from './dto';

const uncategorizedId = 'uncategorized';

@Injectable()
export class GuildsService {
  constructor(
    @Inject(MONGODB_TOKEN) private readonly db: Db,
    private readonly discordOauthService: DiscordOauthService,
  ) {}

  async listMembers(input: { guildId: string; query: string; applicationId: string | null }) {
    const bot = input.applicationId
      ? await this.bots.findOne({ serviceId: input.applicationId })
      : null;

    return this.discordOauthService.listMembers({
      guildId: input.guildId,
      query: input.query,
      token: bot ? bot.token : null,
    });
  }

  async getGuildClans(guildId: string) {
    const [clans, categories] = await Promise.all([
      this.clans
        .find(
          { guild: guildId },
          { projection: { name: 1, tag: 1, order: 1, categoryId: 1 }, sort: { order: 1 } },
        )
        .toArray(),
      this.categories
        .find({ guildId }, { projection: { displayName: 1, order: 1 }, sort: { order: 1 } })
        .toArray(),
    ]);

    const categoryMap = new Map(
      categories.map((category) => [
        category._id.toHexString(),
        { ...category, clans: [] as GuildClanDto[] },
      ]),
    );
    const uncategorized = {
      _id: uncategorizedId,
      order: 9999,
      displayName: 'Uncategorized',
      clans: [] as GuildClanDto[],
    };

    for (const clan of clans) {
      const category = clan.categoryId
        ? categoryMap.get(clan.categoryId.toHexString())
        : uncategorized;
      if (category) {
        category.clans.push(clan);
      } else {
        uncategorized.clans.push(clan);
      }
    }

    return {
      guildId,
      name: 'Unknown',
      clans,
      categories: [...categoryMap.values(), uncategorized],
    };
  }

  async reorderGuildClans({
    categories,
    guildId,
  }: ReorderClanCategoriesInput & { guildId: string }) {
    const clanOps: AnyBulkWriteOperation<ClanStoresEntity>[] = [];
    const categoryOps: AnyBulkWriteOperation<ClanCategoriesEntity>[] = [];

    const clans = categories
      .flatMap((cg) => cg.clans.map((clan) => ({ ...clan, categoryId: cg._id })))
      .sort((a, b) => {
        if (a.categoryId === uncategorizedId && b.categoryId !== uncategorizedId) {
          return -1; // a comes before b
        } else if (a.categoryId !== uncategorizedId && b.categoryId === uncategorizedId) {
          return 1; // b comes before a
        } else {
          return 0; // maintain original order if neither or both are uncategorized
        }
      });

    clans.forEach((clan, order) => {
      clanOps.push({
        updateOne: {
          filter: { _id: new ObjectId(clan._id), guild: guildId },
          update: {
            $set: {
              order,
              categoryId: ObjectId.isValid(clan.categoryId) ? new ObjectId(clan.categoryId) : null,
            },
          },
        },
      });
    });

    categories.forEach((cat, order) => {
      if (ObjectId.isValid(cat._id)) {
        categoryOps.push({
          updateOne: {
            filter: { _id: new ObjectId(cat._id), guildId },
            update: { $set: { order } },
          },
        });
      }
    });

    await this.categories.bulkWrite(categoryOps);
    await this.clans.bulkWrite(clanOps);
    await this.settings.updateOne({ guildId }, { $set: { clansSortingKey: 'order' } });

    return this.getGuildClans(guildId);
  }

  private get clans() {
    return this.db.collection(Collections.CLAN_STORES);
  }

  private get categories() {
    return this.db.collection(Collections.CLAN_CATEGORIES);
  }

  private get settings() {
    return this.db.collection(Collections.SETTINGS);
  }

  private get bots() {
    return this.db.collection(Collections.CUSTOM_BOTS);
  }
}
