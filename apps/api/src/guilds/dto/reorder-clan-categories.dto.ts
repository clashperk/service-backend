import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, ValidateNested } from 'class-validator';

class ReorderCategoriesInput {
  @IsNotEmpty()
  _id: string;

  @IsInt()
  order: number;

  @ValidateNested({ each: true })
  @Type(() => ReorderClansInput)
  @IsArray()
  clans: ReorderClansInput[];
}

class ReorderClansInput {
  @IsNotEmpty()
  _id: string;

  @IsInt()
  order: number;
}

export class ReorderClanCategoriesInput {
  @ValidateNested({ each: true })
  @Type(() => ReorderCategoriesInput)
  @IsArray()
  @ArrayMinSize(1)
  categories: ReorderCategoriesInput[];
}
