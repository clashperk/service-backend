#!/usr/bin/env node

import 'dotenv/config';

import { createClient } from '@clickhouse/client';
import { MongoClient } from 'mongodb';
import {
  applyClickhouse,
  backupClickhouse,
  planClickhouse,
  rollbackClickhouse,
  verifyClickhouse,
} from './clickhouse';
import { Context } from './context';
import { selectIds } from './mapping';
import {
  backfillLeagueSeasons,
  backupMongo,
  planMongo,
  renameMongo,
  rollbackMongo,
  verifyMongo,
} from './mongo';

const USAGE = `Usage: npm run season-split -- <step> [--apply]

Steps, in order (see docs/season-split-runbook.md):
  plan        read-only counts and collision checks
  backup      copy the ids about to change (Mongo) and battle_logs partitions (ClickHouse)
  mongo       rename 28-day YYYY-MM ids to start dates, newest first
  league      create PlayerLeagueSeasons indexes and backfill trophies from PlayerSeasons
  clickhouse  rewrite battle_logs ids and rebuild the legend tables
  verify      read-only checks against the backups
  rollback    restore the old ids from the backups

Without --apply, write steps only print what they would do.
--ids=2026-11 limits a step to those legacy ids; an id is never renamed twice.`;

const STEPS = ['plan', 'backup', 'mongo', 'league', 'clickhouse', 'verify', 'rollback'];

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

const main = async () => {
  const step = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!STEPS.includes(step)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const ids = process.argv.find((arg) => arg.startsWith('--ids='));
  if (ids) selectIds(ids.slice('--ids='.length).split(','));

  const ctx = new Context(apply && !['plan', 'verify'].includes(step));
  const mongo = new MongoClient(requireEnv('MONGODB_URL'));
  const db = mongo.db(requireEnv('MONGODB_DATABASE'));
  const clickhouse = createClient({
    url: requireEnv('CLICKHOUSE_HOST'),
    username: requireEnv('CLICKHOUSE_USER'),
    password: requireEnv('CLICKHOUSE_PASSWORD'),
    request_timeout: 60 * 60 * 1000,
    // Dry runs can't write to ClickHouse even by mistake.
    clickhouse_settings: ctx.apply ? {} : { readonly: '1' },
  });

  try {
    switch (step) {
      case 'plan':
        await planMongo(db, ctx);
        await planClickhouse(clickhouse, ctx);
        break;
      case 'backup':
        await backupMongo(db, ctx);
        await backupClickhouse(clickhouse, ctx);
        break;
      case 'mongo':
        await renameMongo(db, ctx);
        break;
      case 'league':
        await backfillLeagueSeasons(db, ctx);
        break;
      case 'clickhouse':
        await applyClickhouse(clickhouse, ctx);
        break;
      case 'verify':
        await verifyMongo(db, ctx);
        await verifyClickhouse(clickhouse, ctx);
        break;
      case 'rollback':
        await rollbackMongo(db, ctx);
        await rollbackClickhouse(clickhouse, ctx);
        break;
    }
  } finally {
    await Promise.all([mongo.close(), clickhouse.close()]);
  }

  if (ctx.problems.length) {
    console.log(`\n${ctx.problems.length} problem(s):`);
    for (const problem of ctx.problems) console.log(`  - ${problem}`);
    process.exitCode = 1;
  } else {
    const mode = ['plan', 'verify'].includes(step) ? ' (read-only)' : ctx.apply ? '' : ' (dry run)';
    console.log(`\n${step}: ok${mode}`);
  }
};

void main();
