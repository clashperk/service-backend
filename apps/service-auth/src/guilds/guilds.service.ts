import { Collections } from '@app/constants';
import { DiscordClientService } from '@app/discord-client';
import { ClanStoresEntity } from '@app/entities';
import { BotGuildsEntity } from '@app/entities/bot-guilds.entity';
import { ClanCategoriesEntity } from '@app/entities/clan-categories.entity';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Collection } from 'mongodb';
import { GuildAggregated } from './dto/aggregated.dto';

@Injectable()
export class GuildsService {
  constructor(
    private discordClientService: DiscordClientService,
    @Inject(Collections.CLAN_STORES) private clanStoresCollection: Collection<ClanStoresEntity>,
    @Inject(Collections.CLAN_CATEGORIES)
    private clanCategoriesCollection: Collection<ClanCategoriesEntity>,
    @Inject(Collections.BOT_GUILDS)
    private botGuildsCollection: Collection<BotGuildsEntity>,
  ) {}

  getMembers(guildId: string, q: string) {
    return this.discordClientService.listMembers(guildId, q);
  }

  async getGuild(guildId: string) {
    const [guild] = await this.botGuildsCollection
      .aggregate<GuildAggregated>([
        {
          $match: {
            guild: guildId,
          },
        },
        {
          $lookup: {
            from: Collections.CLAN_STORES,
            localField: 'guild',
            foreignField: 'guild',
            as: 'clans',
            pipeline: [
              {
                $sort: { order: 1 },
              },
            ],
          },
        },
        {
          $lookup: {
            from: Collections.CLAN_CATEGORIES,
            localField: 'guild',
            foreignField: 'guildId',
            as: 'categories',
            pipeline: [
              {
                $sort: { order: 1 },
              },
            ],
          },
        },
      ])
      .toArray();

    if (!guild) throw new NotFoundException('Guild not found.');

    const categories = guild?.categories ?? [];
    const clans = guild?.clans ?? [];
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
      name: guild.name,
      guildId: guild.guild,
      clans: clans.map((clan) => ({
        _id: clan._id,
        name: clan.name,
        tag: clan.tag,
        order: clan.order,
      })),
      categories: categories.map((category) => ({
        _id: category._id,
        name: category.displayName,
        order: category.order,
      })),
      grouped: clansGrouped,
    };
  }
}
