import { ClickHouseClient } from '@clickhouse/client';
import { Inject, Injectable } from '@nestjs/common';
import { CLICKHOUSE_TOKEN } from '../db';
import { CommandsUsageLogDto, GetCommandsUsageLogsInputDto } from './dto';

/** Escapes the LIKE wildcards (`%`, `_`) and the escape character (`\`) so the input matches literally. */
export const escapeLikePattern = (value: string) => value.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class MetricsService {
  constructor(@Inject(CLICKHOUSE_TOKEN) private clickhouse: ClickHouseClient) {}

  async getCommandsUsageLogs(input: GetCommandsUsageLogsInputDto) {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      limit: input.limit,
      offset: input.offset,
    };

    if (input.commandId) {
      conditions.push('commandId = {commandId: String}');
      params.commandId = input.commandId;
    }

    if (input.query) {
      conditions.push('commandId ILIKE {query: String}');
      params.query = `%${escapeLikePattern(input.query)}%`;
    }

    if (input.userId) {
      conditions.push('userId = {userId: String}');
      params.userId = input.userId;
    }

    if (input.guildId) {
      conditions.push('guildId = {guildId: String}');
      params.guildId = input.guildId;
    }

    if (input.startDate) {
      conditions.push('createdAt >= {startDate: DateTime}');
      params.startDate = Math.floor(input.startDate / 1000);
    }

    if (input.endDate) {
      conditions.push('createdAt <= {endDate: DateTime}');
      params.endDate = Math.floor(input.endDate / 1000);
    }

    const rows = await this.clickhouse
      .query({
        query: `
          SELECT
            *
          FROM bot_command_logs
          WHERE
            1=1 ${conditions.map((condition) => `AND ${condition}`).join(' ')}
          ORDER BY
            createdAt DESC
          LIMIT {limit: Int32}
          OFFSET {offset: Int32}
        `,
        query_params: params,
      })
      .then((res) => res.json<CommandsUsageLogDto>());

    return { items: rows.data ?? [] };
  }
}
