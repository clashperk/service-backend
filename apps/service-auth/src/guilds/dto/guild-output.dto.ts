export class GuildOutput {
  name: string;
  guildId: string;
  clans: GuildClanOutput[];
  categories: ClanCategoryOutput[];
  grouped: ClanCategoryGroupOutput[];
}

export class GuildClanOutput {
  _id: string;
  name: string;
  tag: string;
  order: number;
}

export class ClanCategoryOutput {
  _id: string;
  name: string;
  order: number;
}

export class ClanCategoryGroupOutput extends ClanCategoryOutput {
  clans: GuildClanOutput[];
}
