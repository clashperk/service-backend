import { ObjectId } from 'mongodb';

export class RostersEntity {
  name: string;
  guildId: string;
  maxMembers?: number;
  minTownHall?: number;
  maxTownHall?: number;
  minHeroLevels?: number;
  roleId?: string | null;
  colorCode?: number;
  clan: {
    tag: string;
    name: string;
    badgeUrl: string;
  };
  members: RosterMemberOfRostersEntity[];
  layout?: string;
  sheetId?: string;
  closed: boolean;
  startTime?: Date | null;
  endTime?: Date | null;
  sortBy?: string;
  useClanAlias?: boolean;
  allowUnlinked?: boolean;
  allowMultiSignup?: boolean;
  category: 'GENERAL' | 'CWL' | 'WAR' | 'TROPHY';
  allowCategorySelection?: boolean;
  lastUpdated: Date;
  createdAt: Date;
}

export interface RosterMemberOfRostersEntity {
  name: string;
  tag: string;
  userId: string | null;
  username: string | null;
  warPreference: 'in' | 'out' | null;
  role: string | null;
  townHallLevel: number;
  heroes: Record<string, number>;
  trophies: number;
  clan?: {
    tag: string;
    name: string;
    alias?: string | null;
  } | null;
  categoryId?: ObjectId | null;
  createdAt: Date;
}
