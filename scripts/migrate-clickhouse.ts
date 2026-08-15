#!/usr/bin/env node

import 'dotenv/config';

import { createClient } from '@clickhouse/client';
import { ClickhouseMigrator } from '../apps/worker/src/db/migrations';

const USAGE = `Usage: npm run migrate:clickhouse [up|status]`;

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

const main = async () => {
  const command = process.argv[2] ?? 'up';
  if (!['up', 'status'].includes(command)) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  const clickhouse = createClient({
    url: requireEnv('CLICKHOUSE_HOST'),
    username: requireEnv('CLICKHOUSE_USER'),
    password: requireEnv('CLICKHOUSE_PASSWORD'),
  });

  try {
    const migrator = new ClickhouseMigrator(clickhouse);

    if (command === 'status') {
      const status = await migrator.status();
      for (const { name, applied } of status) {
        console.log(`${applied ? '[applied]' : '[pending]'} ${name}`);
      }
      return;
    }

    const applied = await migrator.run();
    console.log(`Done. ${applied.length} migration(s) applied.`);
  } finally {
    await clickhouse.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
