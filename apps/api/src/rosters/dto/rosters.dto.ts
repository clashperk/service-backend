import { RosterGroupsEntity, RostersEntity } from '../../db';

export class GetRostersDto {
  rosters: RostersEntity[];
  categories: RosterGroupsEntity[];
}
