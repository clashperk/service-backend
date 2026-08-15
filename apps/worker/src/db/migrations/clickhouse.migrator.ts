import { ClickHouseClient } from '@clickhouse/client';
import { ClickhouseMigration, clickhouseMigrations } from './clickhouse.migrations';

export const MIGRATIONS_TABLE = 'schema_migrations';

export interface MigrationLogger {
  log(message: string): void;
  warn(message: string): void;
}

/**
 * Minimal forward-only migration runner for ClickHouse.
 *
 * There is deliberately no `down` - ClickHouse DDL is not transactional, so a failed rollback
 * leaves worse damage than a failed migration. Roll forward with a new migration instead.
 *
 * Run this from the deploy pipeline, not on application boot: the worker forks one process per
 * CPU, and concurrent runners would race on the same DDL.
 */
export class ClickhouseMigrator {
  public constructor(
    private readonly clickhouse: ClickHouseClient,
    private readonly logger: MigrationLogger = console,
    private readonly migrations: ClickhouseMigration[] = clickhouseMigrations,
  ) {}

  private async ensureMigrationsTable() {
    await this.clickhouse.command({
      query: `
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
          name String,
          appliedAt DateTime DEFAULT now()
        ) ENGINE = ReplacingMergeTree(appliedAt)
        ORDER BY name
      `,
    });
  }

  private async appliedNames(): Promise<Set<string>> {
    const result = await this.clickhouse.query({
      query: `SELECT name FROM ${MIGRATIONS_TABLE} FINAL ORDER BY name`,
    });
    const rows = await result.json<{ name: string }>();
    return new Set((rows.data ?? []).map((row) => row.name));
  }

  private duplicateNames() {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const { name } of this.migrations) {
      if (seen.has(name)) duplicates.add(name);
      seen.add(name);
    }

    return [...duplicates];
  }

  public async pending() {
    await this.ensureMigrationsTable();
    const applied = await this.appliedNames();
    return this.migrations.filter((migration) => !applied.has(migration.name));
  }

  public async status() {
    await this.ensureMigrationsTable();
    const applied = await this.appliedNames();

    return this.migrations.map((migration) => ({
      name: migration.name,
      applied: applied.has(migration.name),
    }));
  }

  /** Returns the names of the migrations it applied. */
  public async run() {
    const duplicates = this.duplicateNames();
    if (duplicates.length) {
      throw new Error(`Duplicate migration name(s): ${duplicates.join(', ')}`);
    }

    const pending = await this.pending();
    if (!pending.length) {
      this.logger.log('ClickHouse schema is up to date.');
      return [];
    }

    for (const migration of pending) {
      this.logger.log(`Applying ${migration.name}...`);

      for (const statement of migration.statements) {
        await this.clickhouse.command({ query: statement });
      }

      await this.clickhouse.insert({
        table: MIGRATIONS_TABLE,
        format: 'JSONEachRow',
        values: [{ name: migration.name }],
      });

      this.logger.log(`Applied ${migration.name}`);
    }

    return pending.map((migration) => migration.name);
  }
}
