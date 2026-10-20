import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export class GuildClanDto {
  @ApiProperty({ type: String })
  _id: ObjectId;

  name: string;
  tag: string;
  order: number;

  league: string;
  level: number;
  members: number;

  @ApiProperty({ type: String })
  categoryId: ObjectId | string;

  /** Finds the clan in commands; `{ALIAS}` in nicknames. */
  alias: string | null;
  /** Shown instead of the clan name in reminders and lists. */
  nickname: string | null;
  /** Commands run in these channels use this clan when no tag is given. */
  channels: string[];
}

export class CategoryDto {
  @ApiProperty({ type: String })
  _id: ObjectId | string;

  displayName: string;
  order: number;
  clans: GuildClanDto[];
}

export class GuildClansDto {
  guildId: string;
  name: string;
  // clans: GuildClanDto[];
  categories: CategoryDto[];
}
