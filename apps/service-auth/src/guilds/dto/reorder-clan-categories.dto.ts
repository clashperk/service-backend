import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, ValidateNested } from 'class-validator';

export class ReorderClanCategoriesInput {
  @ValidateNested({ each: true })
  @IsArray()
  @ArrayMinSize(1)
  categories: ReorderCategoriesInput[];
}

export class ReorderCategoriesInput {
  @IsNotEmpty()
  _id: string;

  @IsInt()
  order: number;

  @ValidateNested({ each: true })
  @IsArray()
  @ArrayMinSize(1)
  clans: ReorderClansInput[];
}

export class ReorderClansInput {
  @IsNotEmpty()
  _id: string;

  @IsInt()
  order: number;
}
