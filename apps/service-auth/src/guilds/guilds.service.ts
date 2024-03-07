import { Collections } from '@app/constants';
import { DiscordClientService } from '@app/discord-client';
import {
  BotGuildsEntity,
  ClanCategoriesEntity,
  ClanStoresEntity,
  SettingsEntity,
} from '@app/entities';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AnyBulkWriteOperation, Collection, ObjectId } from 'mongodb';
import { GuildAggregated, GuildClanOutput, GuildOutput, ReorderClanCategoriesInput } from './dto';

@Injectable()
export class GuildsService {
  constructor(
    private discordClientService: DiscordClientService,
    @Inject(Collections.CLAN_STORES) private clanStoresCollection: Collection<ClanStoresEntity>,
    @Inject(Collections.CLAN_CATEGORIES)
    private clanCategoriesCollection: Collection<ClanCategoriesEntity>,
    @Inject(Collections.BOT_GUILDS)
    private botGuildsCollection: Collection<BotGuildsEntity>,
    @Inject(Collections.SETTINGS)
    private settingsCollection: Collection<SettingsEntity>,
  ) {}

  getMembers(guildId: string, q: string) {
    return this.discordClientService.listMembers(guildId, q);
  }

  async getGuild(guildId: string): Promise<GuildOutput> {
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

    const clansReduced = clans.reduce<Record<string, GuildClanOutput[]>>((prev, curr) => {
      let categoryId = curr.categoryId?.toHexString() || 'general';
      if (!categoryIds.includes(categoryId)) categoryId = 'general';

      prev[categoryId] ??= [];
      prev[categoryId]!.push({
        _id: curr._id.toHexString(),
        name: curr.name,
        tag: curr.tag,
        order: curr.order ?? 0,
      });
      return prev;
    }, {});

    const clansGrouped = Object.entries(clansReduced).map(([categoryId, clans]) => ({
      _id: categoryMap[categoryId]?._id.toHexString() || 'general',
      name: categoryMap[categoryId]?.displayName || 'General',
      order: categoryMap[categoryId]?.order || 0,
      clans,
    }));

    for (const categoryId of categoryIds) {
      const category = categoryMap[categoryId];
      if (category && !(categoryId in clansReduced)) {
        clansGrouped.push({
          _id: category._id.toHexString(),
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
        _id: clan._id.toHexString(),
        name: clan.name,
        tag: clan.tag,
        order: clan.order ?? 0,
      })),
      categories: categories.map((category) => ({
        _id: category._id.toHexString(),
        name: category.displayName,
        order: category.order,
      })),
      grouped: clansGrouped,
    };
  }

  async reorderClanCategories(guildId: string, { categories }: ReorderClanCategoriesInput) {
    const clanOps: AnyBulkWriteOperation<ClanStoresEntity>[] = [];
    const categoryOps: AnyBulkWriteOperation<ClanCategoriesEntity>[] = [];

    const clans = categories
      .flatMap((cg) => cg.clans.map((clan) => ({ ...clan, categoryId: cg._id })))
      .sort((a, b) => {
        if (a.categoryId === 'general' && b.categoryId !== 'general') {
          return -1; // a comes before b
        } else if (a.categoryId !== 'general' && b.categoryId === 'general') {
          return 1; // b comes before a
        } else {
          return 0; // maintain original order if neither or both are 'general'
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
            update: {
              $set: {
                order: order,
              },
            },
          },
        });
      }
    });

    await this.clanCategoriesCollection.bulkWrite(categoryOps);
    await this.clanStoresCollection.bulkWrite(clanOps);
    await this.settingsCollection.updateOne({ guildId }, { $set: { clansSortingKey: 'order' } });

    return this.getGuild(guildId);
  }
}
