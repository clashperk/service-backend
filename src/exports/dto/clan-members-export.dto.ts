import { ArrayMaxSize, ArrayMinSize, IsString } from 'class-validator';

export class ClanMembersExportInput {
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  clanTags: string[];

  @IsString()
  guildId: string;
}
