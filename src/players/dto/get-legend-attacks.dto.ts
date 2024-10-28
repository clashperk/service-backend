import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class GetLegendAttacksInput {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  playerTags: string[];
}
