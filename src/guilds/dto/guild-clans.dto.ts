import { ApiProperty } from '@nestjs/swagger';
import { ObjectId } from 'mongodb';

export class GuildClanDto {
  @ApiProperty({ type: String })
  _id: ObjectId;

  name: string;
  tag: string;
  order: number;

  @ApiProperty({ type: String, nullable: true })
  categoryId?: ObjectId | null;
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
  clans: GuildClanDto[];
  categories: CategoryDto[];
}
