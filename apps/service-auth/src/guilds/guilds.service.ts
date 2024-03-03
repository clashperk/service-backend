import { Collections } from '@app/constants';
import { DiscordClientService } from '@app/discord-client';
import { ClanStoresEntity } from '@app/entities';
import { ClanCategoriesEntity } from '@app/entities/clan-categories.entity';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class GuildsService {
  constructor(
    private discordClientService: DiscordClientService,
    @Inject(Collections.CLAN_STORES) private clanStoresCollection: Collection<ClanStoresEntity>,
    @Inject(Collections.CLAN_CATEGORIES)
    private clanCategoriesCollection: Collection<ClanCategoriesEntity>,
  ) {}

  getMembers(guildId: string, q: string) {
    return this.discordClientService.listMembers(guildId, q);
  }

  async getClansAndCategories(guildId: string) {
    const categories = await this.clanCategoriesCollection
      .find({ guildId })
      .sort({ order: 1 })
      .toArray();
    const clans = await this.clanStoresCollection
      .find({ guild: guildId })
      .sort({ order: 1 })
      .toArray();
    const categoryIds = categories.map((category) => category._id.toHexString());
    const categoryMap = Object.fromEntries(categories.map((cat) => [cat._id.toHexString(), cat]));

    const clansReduced = clans.reduce<Record<string, any[]>>((prev, curr) => {
      let categoryId = curr.categoryId?.toHexString() || 'general';
      if (!categoryIds.includes(categoryId)) categoryId = 'general';

      prev[categoryId] ??= [];
      prev[categoryId]!.push({
        _id: curr._id,
        name: curr.name,
        tag: curr.tag,
        order: curr.order ?? 0,
        guildId: curr.guild,
      });
      return prev;
    }, {});

    const clansGrouped = Object.entries(clansReduced).map(([categoryId, clans]) => ({
      _id: categoryMap[categoryId]?._id || 'general',
      name: categoryMap[categoryId]?.displayName || 'General',
      order: categoryMap[categoryId]?.order || 0,
      clans,
    }));

    for (const categoryId of categoryIds) {
      const category = categoryMap[categoryId];
      if (category && !(categoryId in clansReduced)) {
        clansGrouped.push({
          _id: category._id,
          name: category.displayName,
          order: category.order,
          clans: [],
        });
      }
    }
    clansGrouped.sort((a, b) => a.order - b.order);

    return {
      categories: categories.map((category) => ({
        _id: category._id,
        name: category.displayName,
        order: category.order,
        guildId: category.guildId,
      })),
      grouped: clansGrouped,
      clans: clans.map((clan) => ({
        _id: clan._id,
        name: clan.name,
        tag: clan.tag,
        order: clan.order,
        guildId: clan.guild,
      })),
    };
  }

  getClans(guildId: string) {
    return [guildId];
  }
}
