#!/usr/bin/env node

/**
 * One-off backfill of the legacy Elasticsearch event logs into ClickHouse.
 *
 * Run this AFTER the worker is deployed writing to ClickHouse, so Elasticsearch is no longer
 * receiving new events and this is a single pass over a static index. Running it before the
 * deploy leaves a gap for anything written between the snapshot and the cutover.
 *
 * ClickHouse MergeTree does not deduplicate, so re-running double-writes. It is dry-run by
 * default; pass --write to actually insert.
 *
 *   pnpm run backfill:event-logs                      # count only
 *   pnpm run backfill:event-logs -- --write           # insert
 *   pnpm run backfill:event-logs -- --index=clan_event_logs --write
 */

import 'dotenv/config';

import { Client as Elastic } from '@elastic/elasticsearch';
import { createClient } from '@clickhouse/client';
import {
  BACKFILL_SOURCES,
  BackfilledClanEvent,
  BackfilledClanMemberEvent,
} from '../apps/worker/src/db/migrations/event-logs-backfill';

const PAGE_SIZE = 5_000;
const INSERT_BATCH_SIZE = 50_000;
const KEEP_ALIVE = '5m';

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const onlyIndex = args.find((arg) => arg.startsWith('--index='))?.split('=')[1];

const elastic = new Elastic({
  node: requireEnv('ES_HOST'),
  auth: { username: process.env.ES_USERNAME || 'elastic', password: requireEnv('ES_PASSWORD') },
  ...(process.env.ES_CA_CRT ? { tls: { ca: process.env.ES_CA_CRT } } : {}),
});

const clickhouse = createClient({
  url: requireEnv('CLICKHOUSE_HOST'),
  username: requireEnv('CLICKHOUSE_USER'),
  password: requireEnv('CLICKHOUSE_PASSWORD'),
});

const backfill = async (source: (typeof BACKFILL_SOURCES)[number]) => {
  const { count: total } = await elastic.count({ index: source.index });
  console.log(`\n${source.index}: ${total.toLocaleString()} document(s) in Elasticsearch`);
  if (!total) return;

  // A point-in-time snapshot keeps search_after paging stable and consistent for the whole run.
  const pit = await elastic.openPointInTime({ index: source.index, keep_alive: KEEP_ALIVE });

  let searchAfter: unknown[] | undefined;
  let scanned = 0;
  let skipped = 0;
  let withDiff = 0;
  let inserted = 0;
  let batch: (BackfilledClanEvent | BackfilledClanMemberEvent)[] = [];

  const flush = async () => {
    if (!batch.length) return;
    if (shouldWrite) {
      await clickhouse.insert({ table: source.table, format: 'JSONEachRow', values: batch });
    }
    inserted += batch.length;
    batch = [];
    console.log(`  ${inserted.toLocaleString()} / ${total.toLocaleString()}`);
  };

  try {
    for (;;) {
      const response = await elastic.search<Record<string, unknown>>({
        pit: { id: pit.id, keep_alive: KEEP_ALIVE },
        size: PAGE_SIZE,
        sort: [{ created_at: 'asc' }, { _shard_doc: 'asc' }],
        ...(searchAfter ? { search_after: searchAfter } : {}),
        track_total_hits: false,
      });

      const hits = response.hits.hits;
      if (!hits.length) break;

      for (const hit of hits) {
        scanned++;
        const doc = hit._source ?? {};
        if (doc.diff !== undefined && doc.diff !== null) withDiff++;

        const row = source.map(doc);
        if (!row) {
          skipped++;
          continue;
        }
        batch.push(row);
      }

      if (batch.length >= INSERT_BATCH_SIZE) await flush();

      searchAfter = hits[hits.length - 1].sort;
      if (!searchAfter) break;
    }

    await flush();
  } finally {
    await elastic.closePointInTime({ id: pit.id }).catch(() => null);
  }

  console.log(
    `  scanned=${scanned.toLocaleString()} ${shouldWrite ? 'inserted' : 'would insert'}=${inserted.toLocaleString()} skipped=${skipped.toLocaleString()} carrying-diff=${withDiff.toLocaleString()}`,
  );
};

const main = async () => {
  try {
    const sources = onlyIndex
      ? BACKFILL_SOURCES.filter((source) => source.index === onlyIndex)
      : BACKFILL_SOURCES;

    if (!sources.length) {
      throw new Error(
        `Unknown --index=${onlyIndex}. Expected one of: ${BACKFILL_SOURCES.map((s) => s.index).join(', ')}`,
      );
    }

    if (!shouldWrite) {
      console.log('DRY RUN - nothing will be written. Pass --write to insert.');
    }

    for (const source of sources) {
      await backfill(source);
    }
  } finally {
    await clickhouse.close();
    await elastic.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
