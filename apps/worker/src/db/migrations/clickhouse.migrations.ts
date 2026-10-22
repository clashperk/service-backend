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
    // Carried over from the legacy event log documents that were backfilled into these tables,
    // which had a `diff` field. Nothing writes it any more - rows from the worker leave it at 0.
    name: '0003_event_logs_diff_column',
    statements: [
      `ALTER TABLE clan_event_logs ADD COLUMN IF NOT EXISTS diff Int64 DEFAULT 0`,
      `ALTER TABLE clan_member_event_logs ADD COLUMN IF NOT EXISTS diff Int64 DEFAULT 0`,
    ],
  },
  {
    // player_activities is ordered by player tag, so reading one clan's joins and leaves scanned
    // every row in the range. This copy is ordered by clan; Replacing dedupes the backfill overlap.
    name: '0004_clan_join_leave_logs',
    statements: [
      `
        CREATE TABLE IF NOT EXISTS clan_join_leave_logs (
          clanTag String,
          tag String,
          action LowCardinality(String),
          createdAt DateTime
        ) ENGINE = ReplacingMergeTree()
        PARTITION BY toYYYYMM(createdAt)
        ORDER BY (clanTag, createdAt, tag, action)
        TTL createdAt + INTERVAL 90 DAY
      `,
      `
        CREATE MATERIALIZED VIEW IF NOT EXISTS clan_join_leave_logs_mv TO clan_join_leave_logs AS
        SELECT clanTag, tag, action, createdAt FROM player_activities
        WHERE action IN ('JOINED_CLAN', 'LEFT_CLAN')
      `,
      // Rows written before the view existed, in 30-day slices so no one insert runs too long.
      `
        INSERT INTO clan_join_leave_logs
        SELECT clanTag, tag, action, createdAt FROM player_activities
        WHERE action IN ('JOINED_CLAN', 'LEFT_CLAN')
          AND createdAt >= now() - INTERVAL 90 DAY AND createdAt < now() - INTERVAL 60 DAY
          AND createdAt < (SELECT metadata_modification_time FROM system.tables WHERE database = currentDatabase() AND name = 'clan_join_leave_logs_mv')
      `,
      `
        INSERT INTO clan_join_leave_logs
        SELECT clanTag, tag, action, createdAt FROM player_activities
        WHERE action IN ('JOINED_CLAN', 'LEFT_CLAN')
          AND createdAt >= now() - INTERVAL 60 DAY AND createdAt < now() - INTERVAL 30 DAY
          AND createdAt < (SELECT metadata_modification_time FROM system.tables WHERE database = currentDatabase() AND name = 'clan_join_leave_logs_mv')
      `,
      `
        INSERT INTO clan_join_leave_logs
        SELECT clanTag, tag, action, createdAt FROM player_activities
        WHERE action IN ('JOINED_CLAN', 'LEFT_CLAN')
          AND createdAt >= now() - INTERVAL 30 DAY
          AND createdAt < (SELECT metadata_modification_time FROM system.tables WHERE database = currentDatabase() AND name = 'clan_join_leave_logs_mv')
      `,
    ],
  },
];
