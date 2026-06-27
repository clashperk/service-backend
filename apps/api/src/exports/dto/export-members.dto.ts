import { ArrayMaxSize, ArrayMinSize, IsBoolean, IsString } from 'class-validator';

export class ExportMembersInput {
  @IsString({ each: true })
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  clanTags: string[];

  @IsString()
  guildId: string;

  @IsBoolean()
  scheduled: boolean;
}

export class ExportMembersOutputDto {
  spreadsheetId: string;
  spreadsheetUrl: string;
}
