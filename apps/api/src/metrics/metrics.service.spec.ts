import { ClickHouseClient } from '@clickhouse/client';
import { GetCommandsUsageLogsInputDto } from './dto';
import { escapeLikePattern, MetricsService } from './metrics.service';

type QueryArgs = { query: string; query_params: Record<string, unknown> };

const createStub = (data: unknown[] = []) => {
  const calls: QueryArgs[] = [];
  const client = {
    query: (args: QueryArgs) => {
      calls.push(args);
      return Promise.resolve({ json: () => Promise.resolve({ data }) });
    },
  } as unknown as ClickHouseClient;

  return { client, calls };
};

const buildInput = (overrides: Partial<GetCommandsUsageLogsInputDto> = {}) =>
  Object.assign(new GetCommandsUsageLogsInputDto(), overrides);

describe('escapeLikePattern', () => {
  it('escapes LIKE wildcards and backslashes', () => {
    expect(escapeLikePattern(String.raw`a%b_c\d`)).toBe(String.raw`a\%b\_c\\d`);
  });

  it('leaves ordinary input untouched', () => {
    expect(escapeLikePattern("war'; DROP TABLE x --")).toBe("war'; DROP TABLE x --");
  });
});

describe('MetricsService.getCommandsUsageLogs', () => {
  it('only binds limit/offset when no filters are given', async () => {
    const rows = [{ userId: '1', commandId: 'clan', guildId: '2', createdAt: 0 }];
    const { client, calls } = createStub(rows);

    const result = await new MetricsService(client).getCommandsUsageLogs(buildInput());

    expect(result).toEqual({ items: rows });
    expect(calls[0].query_params).toEqual({ limit: 100, offset: 0 });
    expect(calls[0].query).not.toMatch(/AND /);
  });

  it('binds every filter as a parameter instead of interpolating it', async () => {
    const { client, calls } = createStub();
    const malicious = "x' OR 1=1 --";

    await new MetricsService(client).getCommandsUsageLogs(
      buildInput({
        commandId: malicious,
        query: '50%_off',
        userId: '123456789012345678',
        guildId: '876543210987654321',
        startDate: 1_700_000_000_999,
        endDate: 1_700_000_100_000,
        limit: 10,
        offset: 20,
      }),
    );

    const { query, query_params } = calls[0];
    expect(query).not.toContain(malicious);
    expect(query).toContain('commandId = {commandId: String}');
    expect(query).toContain('commandId ILIKE {query: String}');
    expect(query).toContain('userId = {userId: String}');
    expect(query).toContain('guildId = {guildId: String}');
    expect(query).toContain('createdAt >= {startDate: DateTime}');
    expect(query).toContain('createdAt <= {endDate: DateTime}');
    expect(query_params).toEqual({
      commandId: malicious,
      query: String.raw`%50\%\_off%`,
      userId: '123456789012345678',
      guildId: '876543210987654321',
      startDate: 1_700_000_000,
      endDate: 1_700_000_100,
      limit: 10,
      offset: 20,
    });
  });
});
