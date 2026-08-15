export interface ClickhouseMigration {
  /**
   * Applied state is keyed on this, so never rename or reorder a migration that has shipped.
   * Add a new one instead.
   */
  name: string;
  /** Executed in order. Each entry must be a single statement. */
  statements: string[];
}

/**
 * Tables created before this runner existed are not listed here - they were applied by hand and
 * are left alone. To bring one under version control, dump its live DDL with
 * `SHOW CREATE TABLE <name>` and add it below as a `CREATE TABLE IF NOT EXISTS` migration, so it
 * is a no-op against production and still builds the table on a fresh environment.
 */
export const clickhouseMigrations: ClickhouseMigration[] = [
  {
    name: '0001_clan_event_logs',
    statements: [
      `
        CREATE TABLE IF NOT EXISTS clan_event_logs (
          tag String,
          name String,
          op LowCardinality(String),
          value Int64,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(createdAt)
        PRIMARY KEY (tag, createdAt)
      `,
    ],
  },
  {
    name: '0002_clan_member_event_logs',
    statements: [
      `
        CREATE TABLE IF NOT EXISTS clan_member_event_logs (
          tag String,
          name String,
          clanTag String,
          clanName String,
          op LowCardinality(String),
          value Int64,
          createdAt DateTime DEFAULT now()
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(createdAt)
        PRIMARY KEY (tag, createdAt)
      `,
    ],
  },
  {
    // The Elasticsearch mappings these tables replace carried a `diff` field that the current
    // trackers never populate. Kept so the one-off backfill of historical events stays lossless;
    // rows written by the worker leave it at 0. Safe to drop this migration if the backfill's
    // dry run reports no documents carrying `diff`.
    name: '0003_event_logs_diff_column',
    statements: [
      `ALTER TABLE clan_event_logs ADD COLUMN IF NOT EXISTS diff Int64 DEFAULT 0`,
      `ALTER TABLE clan_member_event_logs ADD COLUMN IF NOT EXISTS diff Int64 DEFAULT 0`,
    ],
  },
];
