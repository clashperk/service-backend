import { RosterCategoriesEntity, RostersEntity } from '@app/entities';

export class GuildRostersOutput {
  rosters: RostersEntity[];
  categories: RosterCategoriesEntity[];
}
