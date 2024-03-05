import { ClanStoresEntity } from '@app/entities';
import { ClanCategoriesEntity } from '@app/entities/clan-categories.entity';
import { WithId } from 'mongodb';

export class GuildAggregated {
  name: string;
  guild: string;
  createdAt: Date;
  clans: WithId<ClanStoresEntity>[];
  categories: WithId<ClanCategoriesEntity>[];
}
