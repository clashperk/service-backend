import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable } from '@nestjs/common';
import { CLICKHOUSE_TOKEN } from '../db';
import { CommandsUsageLogDto, GetCommandsUsageLogsInputDto } from './dto';

@Injectable()
export class MetricsService {
  constructor(@Inject(CLICKHOUSE_TOKEN) private clickhouse: ClickHouseClient) {}

  async getCommandsUsageLogs(input: GetCommandsUsageLogsInputDto) {
    let where = '';

    if (input.commandId) {
      where += ` and commandId='${input.commandId}'`;
    }

    if (input.userId) {
      where += ` and userId='${input.userId}'`;
    }

    if (input.guildId) {
      where += ` and guildId='${input.guildId}'`;
    }

    if (input.startDate) {
      input.startDate = Math.floor(input.startDate / 1000);
      where += ` and createdAt >= {startDate: DateTime}`;
    }

    if (input.endDate) {
      input.endDate = Math.floor(input.endDate / 1000);
      where += ` and createdAt <= {endDate: DateTime}`;
    }

    const rows = await this.clickhouse
      .query({
        query: `
          select * from bot_command_logs
          where 1=1 ${where}
          order by createdAt desc
          limit {limit: Int32}
          offset {offset: Int32}
        `,
        query_params: {
          startDate: input.startDate,
          endDate: input.endDate,
          limit: input.limit,
          offset: input.offset,
        },
      })
      .then((res) => res.json<CommandsUsageLogDto>());

    return { items: rows.data ?? [] };
  }
}
