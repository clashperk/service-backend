import { IsInt, IsNotEmpty, ValidateNested } from 'class-validator';

export class ReorderCategoriesInput {
  @IsNotEmpty()
  _id: string;

  @IsNotEmpty()
  name: string;

  @IsInt()
  order: number;

  @ValidateNested({ each: true })
  clans: ReorderClansInput[];
}

export class ReorderClansInput {
  @IsNotEmpty()
  _id: string;

  @IsInt()
  order: number;

  @IsNotEmpty()
  tag: string;

  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  guildId: string;
}
