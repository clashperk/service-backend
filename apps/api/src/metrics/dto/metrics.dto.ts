import { DateTime, NumberString } from '@app/decorators';
import { IsOptional, Matches, Max, Min } from 'class-validator';

const SNOWFLAKE_REGEX = /^\d{17,20}$/;

export class GetCommandsUsageLogsInputDto {
  @IsOptional()
  @Matches(SNOWFLAKE_REGEX, { message: 'userId must be a valid Discord snowflake' })
  userId?: string;

  @IsOptional()
  @Matches(SNOWFLAKE_REGEX, { message: 'guildId must be a valid Discord snowflake' })
  guildId?: string;

  @IsOptional()
  commandId?: string;

  @IsOptional()
  @DateTime()
  startDate?: number;

  @IsOptional()
  @DateTime()
  endDate?: number;

  @IsOptional()
  query?: string;

  @NumberString(100)
  @Max(1000)
  @Min(1)
  limit: number = 100;

  @NumberString(0)
  @Min(0)
  offset: number = 0;
}

export class CommandsUsageLogDto {
  userId: string;
  commandId: string;
  guildId: string;
  createdAt: number;
}

export class CommandsUsageLogItemsDto {
  items: CommandsUsageLogDto[];
}
