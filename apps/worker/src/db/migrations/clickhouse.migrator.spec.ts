import { ClickHouseClient } from '@clickhouse/client';
import { ClickhouseMigration } from './clickhouse.migrations';
import { ClickhouseMigrator, MIGRATIONS_TABLE } from './clickhouse.migrator';

const migrations: ClickhouseMigration[] = [
  { name: '0001_first', statements: ['CREATE TABLE first'] },
  { name: '0002_second', statements: ['CREATE TABLE second', 'ALTER TABLE second ADD COLUMN x'] },
];

const stubLogger = { log: jest.fn(), warn: jest.fn() };

const createStub = (alreadyApplied: string[] = []) => {
  const commands: string[] = [];
  const recorded: string[] = [];

  const client = {
    command: ({ query }: { query: string }) => {
      commands.push(query.trim());
      return Promise.resolve({});
    },
    query: () =>
      Promise.resolve({
        json: () => Promise.resolve({ data: alreadyApplied.map((name) => ({ name })) }),
      }),
    insert: ({ values }: { values: { name: string }[] }) => {
      recorded.push(...values.map((value) => value.name));
      return Promise.resolve({});
    },
  } as unknown as ClickHouseClient;

  return { client, commands, recorded };
};

describe('ClickhouseMigrator', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the registry table and applies every pending migration in order', async () => {
    const { client, commands, recorded } = createStub();
    const applied = await new ClickhouseMigrator(client, stubLogger, migrations).run();

    expect(commands[0]).toContain(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE}`);
    expect(commands.slice(1)).toEqual([
      'CREATE TABLE first',
      'CREATE TABLE second',
      'ALTER TABLE second ADD COLUMN x',
    ]);
    expect(recorded).toEqual(['0001_first', '0002_second']);
    expect(applied).toEqual(['0001_first', '0002_second']);
  });

  it('skips migrations that are already recorded', async () => {
    const { client, commands, recorded } = createStub(['0001_first']);
    const applied = await new ClickhouseMigrator(client, stubLogger, migrations).run();

    expect(commands.slice(1)).toEqual(['CREATE TABLE second', 'ALTER TABLE second ADD COLUMN x']);
    expect(recorded).toEqual(['0002_second']);
    expect(applied).toEqual(['0002_second']);
  });

  it('is a no-op when everything is applied', async () => {
    const { client, commands, recorded } = createStub(['0001_first', '0002_second']);
    const applied = await new ClickhouseMigrator(client, stubLogger, migrations).run();

    expect(commands.slice(1)).toEqual([]);
    expect(recorded).toEqual([]);
    expect(applied).toEqual([]);
  });

  it('refuses to run when two migrations share a name', async () => {
    const { client } = createStub();
    const duplicated = [...migrations, { name: '0001_first', statements: ['SELECT 1'] }];

    await expect(new ClickhouseMigrator(client, stubLogger, duplicated).run()).rejects.toThrow(
      /Duplicate migration name\(s\): 0001_first/,
    );
  });

  it('reports applied and pending state', async () => {
    const { client } = createStub(['0001_first']);
    const status = await new ClickhouseMigrator(client, stubLogger, migrations).status();

    expect(status).toEqual([
      { name: '0001_first', applied: true },
      { name: '0002_second', applied: false },
    ]);
  });
});
