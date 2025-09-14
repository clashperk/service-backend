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
      where += ` AND commandId='${input.commandId}'`;
    }

    if (input.userId) {
      where += ` AND userId='${input.userId}'`;
    }

    if (input.guildId) {
      where += ` AND guildId='${input.guildId}'`;
    }

    if (input.startDate) {
      input.startDate = Math.floor(input.startDate / 1000);
      where += ` AND createdAt >= {startDate: DateTime}`;
    }

    if (input.endDate) {
      input.endDate = Math.floor(input.endDate / 1000);
      where += ` AND createdAt <= {endDate: DateTime}`;
    }

    const rows = await this.clickhouse
      .query({
        query: `
          SELECT
            *
          FROM bot_command_logs
          WHERE
            1=1 ${where}
          ORDER BY createdAt DESC
          LIMIT {limit: Int32}
          OFFSET {offset: Int32}
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
