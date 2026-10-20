import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export class RostersEntity {
  @ApiProperty({ type: String })
  _id: ObjectId;

  name: string;
  guildId: string;
  maxMembers?: number;
  minTownHall?: number;
  maxTownHall?: number;
  minHeroLevels?: number;
  roleId?: string | null;
  colorCode?: number;
  /** Null for a roster open to every clan. */
  clan: {
    tag: string;
    name: string;
    badgeUrl: string;
    league?: { id: number; name: string };
  } | null;
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
  maxAccountsPerUser?: number | null;
  rosterImage?: string | null;

  @ApiProperty({ type: String })
  category: 'GENERAL' | 'CWL' | 'WAR' | 'TROPHY' | 'NO_CLAN';

  allowCategorySelection?: boolean;
  requireCategorySelection?: boolean;
  categorySelectionCustomText?: string | null;
  logChannelId?: string | null;
  lastUpdated: Date;
  createdAt: Date;
}

export class RosterMemberOfRostersEntity {
  name: string;
  tag: string;
  userId: string | null;
  username: string | null;
  displayName?: string | null;

  @ApiProperty({ type: String })
  warPreference: 'in' | 'out' | null;

  role: string | null;
  townHallLevel: number;
  heroes: Record<string, number>;
  trophies: number;
  leagueId?: number;

  clan?: {
    tag: string;
    name: string;
    alias?: string | null;
  } | null;

  @ApiProperty({ type: String })
  categoryId?: ObjectId | null;

  createdAt: Date;
}
