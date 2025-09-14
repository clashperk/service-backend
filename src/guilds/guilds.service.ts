import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { ClanStoresEntity, Collections, MONGODB_TOKEN, PlayerLinksEntity } from '../db';

@Injectable()
export class GuildsService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  getSettings(guildId: string) {
    return { guildId } as unknown as PlayerLinksEntity;
  }

  async getClans(guildId: string) {
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
        { ...category, clans: [] as ClanStoresEntity[] },
      ]),
    );
    const uncategorized = {
      _id: null,
      order: 9999,
      displayName: 'Uncategorized',
      clans: [] as ClanStoresEntity[],
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

  get clans() {
    return this.db.collection(Collections.CLAN_STORES);
  }

  get categories() {
    return this.db.collection(Collections.CLAN_CATEGORIES);
  }
}
