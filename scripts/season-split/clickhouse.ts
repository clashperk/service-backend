import { ClickHouseClient } from '@clickhouse/client';
import { BACKUP_SUFFIX, Context } from './context';
import { isLegacyId, isSelected, mapLegacyId, SeasonIdMapping } from './mapping';

const ANCHOR = "toDateTime('2025-10-06 05:00:00', 'UTC')";
const BATTLE_SEASON_DEFAULT = `formatDateTime(${ANCHOR} + toIntervalSecond(intDiv(dateDiff('second', ${ANCHOR}, ingested_at), 2419200) * 2419200), '%Y-%m-%d', 'UTC')`;
const LEGACY_BATTLE_SEASON_DEFAULT = `formatDateTime(addMonths(toDate('2025-10-01'), toInt32(intDiv(dateDiff('second', ${ANCHOR}, ingested_at), 28 * 86400))), '%Y-%m', 'UTC')`;

const START_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MUTATION_POLL_MS = 10_000;

const PROJECTED_MV = `CREATE MATERIALIZED VIEW IF NOT EXISTS legend_players_projected_mv TO legend_players_projected
(
    player_tag String,
    player_name String,
    trophies Int32,
    battle_season String,
    ingested_at DateTime('UTC')
)
AS SELECT
    tag AS player_tag,
    name AS player_name,
    trophies,
    seasonId AS battle_season,
    toDateTime(createdAt, 'UTC') AS ingested_at
FROM legend_players`;

interface SeasonColumn {
  table: string;
  column: string;
}

const COLUMNS: SeasonColumn[] = [
  { table: 'battle_logs', column: 'battle_season' },
  { table: 'legend_players', column: 'seasonId' },
  { table: 'legend_players_projected', column: 'battle_season' },
  { table: 'legend_players_ranked', column: 'battle_season' },
  { table: 'legend_players_ranked_projected', column: 'battle_season' },
];

const literal = (value: string) => {
  if (!/^[0-9-]+$/.test(value)) throw new Error(`unexpected season id ${value}`);
  return `'${value}'`;
};

const select = async <T>(ch: ClickHouseClient, query: string) =>
  (await ch.query({ query, format: 'JSONEachRow' })).json<T>();

const tableExists = async (ch: ClickHouseClient, name: string) => {
  const [row] = await select<{ n: string | number }>(
    ch,
    `SELECT count() AS n FROM system.tables WHERE database = currentDatabase() AND name = '${name}'`,
  );
  return Number(row.n) > 0;
};

/** Distinct ids in a column with row counts, newest first. */
const distinctIds = async (ch: ClickHouseClient, { table, column }: SeasonColumn) => {
  const rows = await select<{ id: string; n: string | number }>(
    ch,
    `SELECT ${column} AS id, count() AS n FROM ${table} GROUP BY id ORDER BY id DESC`,
  );
  return rows.map((row) => ({ id: row.id, n: Number(row.n) }));
};

/** Maps a stored id to its start-date id; start dates map to themselves. */
const targetOf = (id: string) => (isLegacyId(id) ? mapLegacyId(id).seasonId : id);

const transform = (column: string, mappings: SeasonIdMapping[]) =>
  `transform(${column}, [${mappings.map((m) => literal(m.legacyId)).join(', ')}], [${mappings
    .map((m) => literal(m.seasonId))
    .join(', ')}], ${column})`;

const waitForMutations = async (ch: ClickHouseClient, table: string) => {
  for (;;) {
    const [row] = await select<{ pending: string | number; failure: string }>(
      ch,
      `SELECT count() AS pending, any(latest_fail_reason) AS failure FROM system.mutations
       WHERE database = currentDatabase() AND table = '${table}' AND NOT is_done`,
    );
    if (row.failure) throw new Error(`${table} mutation failed: ${row.failure}`);
    if (Number(row.pending) === 0) return;
    await new Promise((resolve) => setTimeout(resolve, MUTATION_POLL_MS));
  }
};

/** The YYYYMM partitions a season's battles land in (battle_logs is partitioned by month). */
const monthPartitions = ({ startTime, endTime }: SeasonIdMapping) => {
  const toId = (date: Date) => date.toISOString().slice(0, 7).replace('-', '');
  return [...new Set([toId(startTime), toId(new Date(endTime.getTime() - 1))])];
};

export const planClickhouse = async (ch: ClickHouseClient, ctx: Context) => {
  for (const source of COLUMNS) {
    console.log(`\n${source.table}.${source.column}`);
    for (const { id, n } of await distinctIds(ch, source)) {
      if (!isLegacyId(id) && !START_DATE.test(id))
        ctx.problem(`${source.table} has unexpected id '${id}'`);
      console.log(`  ${id} (${n}) -> ${targetOf(id)}`);
    }
    if (await tableExists(ch, source.table + BACKUP_SUFFIX)) {
      console.log(`  backup ${source.table + BACKUP_SUFFIX} exists`);
    }
  }
};

export const backupClickhouse = async (ch: ClickHouseClient, ctx: Context) => {
  // The legend tables are rebuilt, and the swap keeps their old copies; battle_logs is updated in place.
  const backup = 'battle_logs' + BACKUP_SUFFIX;
  if (await tableExists(ch, backup)) {
    console.log(`skip: ${backup} exists; the first backup is kept`);
    return;
  }

  await ctx.write(`create ${backup}`, () =>
    ch.command({ query: `CREATE TABLE ${backup} AS battle_logs` }),
  );
  const partitions = await select<{ id: string }>(
    ch,
    `SELECT DISTINCT partition_id AS id FROM system.parts
     WHERE database = currentDatabase() AND table = 'battle_logs' AND active ORDER BY id DESC`,
  );
  for (const { id } of partitions) {
    await ctx.write(`hard-link battle_logs partition ${id} into ${backup}`, () =>
      ch.command({ query: `ALTER TABLE ${backup} ATTACH PARTITION ID '${id}' FROM battle_logs` }),
    );
  }
};

const updateBattleLogs = async (ch: ClickHouseClient, ctx: Context) => {
  await ctx.write('set battle_logs.battle_season default to the season start date', () =>
    ch.command({
      query: `ALTER TABLE battle_logs MODIFY COLUMN battle_season String DEFAULT ${BATTLE_SEASON_DEFAULT}`,
    }),
  );

  const legacy = (await distinctIds(ch, COLUMNS[0])).filter(
    ({ id }) => isLegacyId(id) && isSelected(id),
  );
  for (const { id, n } of legacy) {
    const mapping = mapLegacyId(id);
    for (const partition of monthPartitions(mapping)) {
      await ctx.write(
        `battle_logs ${id} -> ${mapping.seasonId} in partition ${partition} (${n} rows in total)`,
        async () => {
          await ch.command({
            query: `ALTER TABLE battle_logs UPDATE battle_season = ${literal(mapping.seasonId)}
                  IN PARTITION ID '${partition}' WHERE battle_season = ${literal(id)}`,
          });
          await waitForMutations(ch, 'battle_logs');
        },
      );
    }
  }

  if (!ctx.apply) return;
  const left = (await distinctIds(ch, COLUMNS[0])).filter(
    ({ id }) => isLegacyId(id) && isSelected(id),
  );
  if (!left.length) return;
  // Rows outside their season's month partitions; one pass over the whole table catches them.
  const mappings = left.map(({ id }) => mapLegacyId(id));
  await ctx.write(
    `battle_logs: sweep ${left.length} leftover ids across all partitions`,
    async () => {
      await ch.command({
        query: `ALTER TABLE battle_logs UPDATE battle_season = ${transform('battle_season', mappings)}
              WHERE battle_season IN (${mappings.map((m) => literal(m.legacyId)).join(', ')})`,
      });
      await waitForMutations(ch, 'battle_logs');
    },
  );
};

interface Rebuild {
  table: string;
  create: (name: string) => string;
  /** One INSERT per stored id, newest first. */
  fill: (name: string, sourceId: string, targetId: string) => string;
  column: string;
}

const rebuild = async (
  ch: ClickHouseClient,
  ctx: Context,
  { table, create, fill, column }: Rebuild,
) => {
  const backup = table + BACKUP_SUFFIX;
  const next = `${table}_next`;
  if (await tableExists(ch, backup)) {
    console.log(`skip: ${table} already rebuilt (${backup} exists)`);
    return;
  }

  await ctx.write(`drop any leftover ${next}`, () =>
    ch.command({ query: `DROP TABLE IF EXISTS ${next}` }),
  );
  await ctx.write(`create ${next}`, () => ch.command({ query: create(next) }));
  for (const { id, n } of await distinctIds(ch, { table, column })) {
    await ctx.write(`${next} <- ${table} ${id} as ${targetOf(id)} (${n} rows)`, () =>
      ch.command({ query: fill(next, id, targetOf(id)) }),
    );
  }
  await ctx.write(`swap ${table} with ${next}`, () =>
    ch.command({ query: `EXCHANGE TABLES ${table} AND ${next}` }),
  );
  await ctx.write(`keep the old ${table} as ${backup}`, () =>
    ch.command({ query: `RENAME TABLE ${next} TO ${backup}` }),
  );
};

const RANKED_COLUMNS = 'player_tag, player_name, battle_season, trophies, rank, updated_at';

const rankedRebuild = (table: string): Rebuild => ({
  table,
  column: 'battle_season',
  create: (name) => `CREATE TABLE ${name}
    (player_tag String, player_name String, battle_season String, trophies Int32, rank UInt32, updated_at DateTime('UTC'))
    ENGINE = MergeTree PARTITION BY battle_season ORDER BY (battle_season, rank)`,
  fill: (name, sourceId, targetId) => `INSERT INTO ${name} (${RANKED_COLUMNS})
    SELECT player_tag, player_name, ${literal(targetId)}, trophies, rank, updated_at
    FROM ${table} WHERE battle_season = ${literal(sourceId)}`,
});

export const applyClickhouse = async (ch: ClickHouseClient, ctx: Context) => {
  await updateBattleLogs(ch, ctx);

  if (!(await tableExists(ch, 'legend_players' + BACKUP_SUFFIX))) {
    await ctx.write('drop legend_players_projected_mv while its tables are swapped', () =>
      ch.command({ query: 'DROP VIEW IF EXISTS legend_players_projected_mv' }),
    );
  }

  // Partitioned by season instead of createdAt's month, so ReplacingMergeTree can dedupe a whole season.
  await rebuild(ch, ctx, {
    table: 'legend_players',
    column: 'seasonId',
    create: (name) => `CREATE TABLE ${name}
      (name String, tag String, trophies Int32, streak Int32, seasonId String, createdAt DateTime DEFAULT now())
      ENGINE = ReplacingMergeTree PARTITION BY seasonId PRIMARY KEY (tag, seasonId) ORDER BY (tag, seasonId)`,
    // Keeps each player's latest row and drops the rows stamped in 2070.
    fill: (
      name,
      sourceId,
      targetId,
    ) => `INSERT INTO ${name} (name, tag, trophies, streak, seasonId, createdAt)
      SELECT argMax(name, createdAt), tag, argMax(trophies, createdAt), argMax(streak, createdAt), ${literal(targetId)}, max(createdAt)
      FROM legend_players WHERE seasonId = ${literal(sourceId)} AND createdAt < now() + INTERVAL 1 DAY
      GROUP BY tag`,
  });

  await rebuild(ch, ctx, {
    table: 'legend_players_projected',
    column: 'battle_season',
    create: (name) => `CREATE TABLE ${name}
      (player_tag String, player_name String, trophies Int32, battle_season String, ingested_at DateTime('UTC'))
      ENGINE = ReplacingMergeTree(ingested_at) PARTITION BY battle_season ORDER BY (player_tag, battle_season)`,
    fill: (
      name,
      sourceId,
      targetId,
    ) => `INSERT INTO ${name} (player_tag, player_name, trophies, battle_season, ingested_at)
      SELECT player_tag, player_name, trophies, ${literal(targetId)}, ingested_at
      FROM legend_players_projected
      WHERE battle_season = ${literal(sourceId)} AND ingested_at < now() + INTERVAL 1 DAY`,
  });

  await ctx.write('recreate legend_players_projected_mv', () =>
    ch.command({ query: PROJECTED_MV }),
  );

  await rebuild(ch, ctx, rankedRebuild('legend_players_ranked'));
  await rebuild(ch, ctx, rankedRebuild('legend_players_ranked_projected'));
};

export const verifyClickhouse = async (ch: ClickHouseClient, ctx: Context) => {
  for (const source of COLUMNS) {
    const live = await distinctIds(ch, source);
    for (const { id } of live) {
      if (!START_DATE.test(id) && isSelected(id)) ctx.problem(`${source.table} still has '${id}'`);
    }

    const backup = source.table + BACKUP_SUFFIX;
    if (!(await tableExists(ch, backup))) {
      console.log(`\n${source.table}: no backup to compare against`);
      continue;
    }
    // legend_players had several rows per player and season; the rebuild keeps one.
    const keyed = source.table === 'legend_players' || source.table === 'legend_players_projected';
    const tagColumn = source.table === 'legend_players' ? 'tag' : 'player_tag';
    const before = await select<{ id: string; n: string | number }>(
      ch,
      `SELECT ${source.column} AS id, ${keyed ? `uniqExact(${tagColumn})` : 'count()'} AS n FROM ${backup}
       ${source.table === 'legend_players' ? 'WHERE createdAt < now() + INTERVAL 1 DAY' : ''}
       ${source.table === 'legend_players_projected' ? 'WHERE ingested_at < now() + INTERVAL 1 DAY' : ''}
       GROUP BY id ORDER BY id DESC`,
    );
    const after = new Map(
      (
        await select<{ id: string; n: string | number }>(
          ch,
          `SELECT ${source.column} AS id, ${keyed ? `uniqExact(${tagColumn})` : 'count()'} AS n
           FROM ${source.table} GROUP BY id`,
        )
      ).map((row) => [row.id, Number(row.n)]),
    );

    console.log(`\n${source.table} (backup -> live)`);
    for (const { id, n } of before) {
      if (isLegacyId(id) && !isSelected(id)) continue;
      const target = targetOf(id);
      const now = after.get(target) ?? 0;
      console.log(`  ${id} (${n}) -> ${target} (${now})`);
      if (now < Number(n))
        ctx.problem(`${source.table} has fewer rows for ${target} than the backup had for ${id}`);
    }
  }

  const [column] = await select<{ expr: string }>(
    ch,
    `SELECT default_expression AS expr FROM system.columns
     WHERE database = currentDatabase() AND table = 'battle_logs' AND name = 'battle_season'`,
  );
  if (!column.expr.includes('%Y-%m-%d'))
    ctx.problem('battle_logs.battle_season default is not the start date');
  if (!(await tableExists(ch, 'legend_players_projected_mv')))
    ctx.problem('legend_players_projected_mv is missing');
};

/** Swaps the rebuilt tables back and turns battle_logs ids back into the legacy YYYY-MM. */
export const rollbackClickhouse = async (ch: ClickHouseClient, ctx: Context) => {
  await ctx.write('drop legend_players_projected_mv while its tables are swapped', () =>
    ch.command({ query: 'DROP VIEW IF EXISTS legend_players_projected_mv' }),
  );
  for (const { table } of COLUMNS.slice(1)) {
    const backup = table + BACKUP_SUFFIX;
    if (!(await tableExists(ch, backup))) {
      console.log(`skip: no ${backup}`);
      continue;
    }
    await ctx.write(`swap ${table} back from ${backup}`, () =>
      ch.command({ query: `EXCHANGE TABLES ${table} AND ${backup}` }),
    );
    await ctx.write(`keep the split ${table} as ${table}_split_rolled_back`, () =>
      ch.command({ query: `RENAME TABLE ${backup} TO ${table}_split_rolled_back` }),
    );
  }
  await ctx.write('recreate legend_players_projected_mv', () =>
    ch.command({ query: PROJECTED_MV }),
  );

  await ctx.write('set battle_logs.battle_season default back to the legacy YYYY-MM id', () =>
    ch.command({
      query: `ALTER TABLE battle_logs MODIFY COLUMN battle_season String DEFAULT ${LEGACY_BATTLE_SEASON_DEFAULT}`,
    }),
  );
  const startDates = (await distinctIds(ch, COLUMNS[0])).filter(({ id }) => START_DATE.test(id));
  for (const { id } of startDates) {
    const legacyId =
      new Date(`${id}T05:00:00Z`) < new Date('2025-10-06T05:00:00Z') ? null : legacyIdOf(id);
    if (!legacyId) {
      ctx.problem(`battle_logs ${id}: no legacy id to restore`);
      continue;
    }
    await ctx.write(`battle_logs ${id} -> ${legacyId}`, async () => {
      await ch.command({
        query: `ALTER TABLE battle_logs UPDATE battle_season = ${literal(legacyId)} WHERE battle_season = ${literal(id)}`,
      });
      await waitForMutations(ch, 'battle_logs');
    });
  }
};

/** The legacy YYYY-MM id of a 28-day season start date: one month per season since Oct 2025. */
const legacyIdOf = (startDate: string) => {
  const seasons = Math.round(
    (Date.parse(`${startDate}T05:00:00Z`) - Date.UTC(2025, 9, 6, 5)) / 2419200000,
  );
  const month = new Date(Date.UTC(2025, 9 + seasons, 1));
  return month.toISOString().slice(0, 7);
};
