import { DateTime, NumberString } from '@app/decorators';
import { IsOptional, Max, Min } from 'class-validator';

export class GetCommandsUsageLogsInputDto {
  @IsOptional()
  userId?: string;

  @IsOptional()
  guildId?: string;

  @IsOptional()
  commandId?: string;

  @IsOptional()
  @DateTime()
  startDate?: number;

  @IsOptional()
  @DateTime()
  endDate?: number;

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

export class GetCommandsUsageLogsDto {
  items: CommandsUsageLogDto[];
}
