#!/usr/bin/env node

/**
 * Captures the `upstream_feed` packets the worker publishes, and derives an
 * empirical schema from them.
 *
 * The packets are built inline as untyped objects at each emit site, and the
 * shapes are not uniform — the `clan` sub-object alone carries a different
 * field set in almost every op. Porting a tracker to Go means reproducing them
 * exactly, so the corpus this writes is the reference the Go encoder is tested
 * against.
 *
 *   npm run capture:feed -- record [--out FILE] [--seconds N] [--max N]
 *   npm run capture:feed -- summarize [FILE]
 *
 * The corpus holds real player names and tags. It is gitignored; keep it that way.
 */

import 'dotenv/config';

import Redis from 'ioredis';
import { appendFileSync, createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const CHANNEL = 'upstream_feed';
const DEFAULT_OUT = 'upstream-corpus.jsonl';

/** Mirrors libs/constants Flags; the bot switches on these raw values. */
const OP_NAMES: Record<number, string> = {
  1: 'DONATION_LOG',
  2: 'CLAN_FEED_LOG',
  8: 'CLAN_EMBED_LOG',
  16: 'CLAN_GAMES_LOG',
  32: 'CLAN_WAR_LOG',
  512: 'TOWN_HALL_LOG',
  1024: 'PLAYER_FEED_LOG',
  4096: 'CAPITAL_LOG',
  8192: 'CLAN_EVENT_LOG',
  16384: 'DONATION_LOG_V2',
};

const flag = (name: string, fallback?: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

async function record() {
  const out = flag('out', DEFAULT_OUT)!;
  const seconds = Number(flag('seconds', '900'));
  const max = Number(flag('max', '100000'));

  const redis = new Redis(requireEnv('REDIS_URL'));
  const counts = new Map<number, number>();
  let total = 0;

  const finish = async (reason: string) => {
    await redis.quit();
    console.log(`\n${reason}. Wrote ${total} packets to ${out}`);
    for (const [op, count] of [...counts].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(op).padStart(6)} ${(OP_NAMES[op] ?? '?').padEnd(18)} ${count}`);
    }
    console.log(`\nNext: npm run capture:feed -- summarize ${out}`);
    process.exit(0);
  };

  await redis.subscribe(CHANNEL);
  console.log(`Subscribed to ${CHANNEL}. Recording for ${seconds}s (max ${max})...`);

  redis.on('message', (_channel, message) => {
    appendFileSync(out, message + '\n');
    total += 1;

    try {
      const op = JSON.parse(message).op;
      counts.set(op, (counts.get(op) ?? 0) + 1);
    } catch {
      counts.set(-1, (counts.get(-1) ?? 0) + 1);
    }

    if (total % 250 === 0) process.stdout.write(`\r  ${total} packets`);
    if (total >= max) void finish('Hit max');
  });

  setTimeout(() => void finish('Time is up'), seconds * 1000);
  process.on('SIGINT', () => void finish('Interrupted'));
}

interface FieldStat {
  count: number;
  types: Set<string>;
  samples: Set<string>;
}

/**
 * Flattens a packet into `a.b[].c` paths. Arrays descend into every element so
 * a field present on only some members still shows up, with a share below 100%.
 */
function walk(value: unknown, path: string, into: Map<string, FieldStat>) {
  const record = (type: string, sample?: string | number | boolean) => {
    const stat = into.get(path) ?? { count: 0, types: new Set(), samples: new Set() };
    stat.count += 1;
    stat.types.add(type);
    if (sample !== undefined && stat.samples.size < 3) {
      stat.samples.add(typeof sample === 'string' ? sample.slice(0, 24) : String(sample));
    }
    into.set(path, stat);
  };

  if (value === null) return record('null');
  if (Array.isArray(value)) {
    record('array');
    for (const item of value) walk(item, `${path}[]`, into);
    return;
  }
  if (typeof value === 'object') {
    if (path) record('object');
    for (const [key, child] of Object.entries(value)) {
      walk(child, path ? `${path}.${key}` : key, into);
    }
    return;
  }
  record(typeof value, value as string | number | boolean);
}

async function summarize() {
  const file = process.argv[3]?.startsWith('--') ? DEFAULT_OUT : (process.argv[3] ?? DEFAULT_OUT);
  if (!existsSync(file)) {
    console.error(`No corpus at ${file}. Run: npm run capture:feed -- record`);
    process.exitCode = 1;
    return;
  }

  const byOp = new Map<number, { packets: number; fields: Map<string, FieldStat> }>();

  const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;

    let packet: Record<string, unknown>;
    try {
      packet = JSON.parse(line);
    } catch {
      continue;
    }

    const op = typeof packet.op === 'number' ? packet.op : -1;
    const entry = byOp.get(op) ?? { packets: 0, fields: new Map<string, FieldStat>() };
    entry.packets += 1;
    walk(packet, '', entry.fields);
    byOp.set(op, entry);
  }

  for (const [op, entry] of [...byOp].sort((a, b) => a[0] - b[0])) {
    console.log(`\n${'='.repeat(78)}`);
    console.log(`op ${op} — ${OP_NAMES[op] ?? 'UNKNOWN'} — ${entry.packets} packets`);
    console.log('='.repeat(78));

    // Array-scoped paths repeat per element, so their share is relative to the
    // parent array rather than the packet count.
    const parentCount = (path: string) => {
      const parent = path.replace(/\.[^.[\]]+$/, '');
      return parent.includes('[]')
        ? (entry.fields.get(parent)?.count ?? entry.packets)
        : entry.packets;
    };

    for (const [path, stat] of [...entry.fields].sort((a, b) => a[0].localeCompare(b[0]))) {
      const share = Math.round((stat.count / parentCount(path)) * 100);
      const optional = share < 100 ? ' OPTIONAL' : '';
      const types = [...stat.types].join('|');
      const samples = stat.samples.size ? `  e.g. ${[...stat.samples].join(', ')}` : '';
      console.log(
        `  ${path.padEnd(42)} ${types.padEnd(10)} ${String(share).padStart(3)}%${optional}${samples}`,
      );
    }
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log('OPTIONAL fields are the ones that need omitempty in Go. Everything');
  console.log('else must always be emitted, including zero values and empty arrays.');
}

const main = async () => {
  const command = process.argv[2];
  if (command === 'record') return record();
  if (command === 'summarize') return summarize();

  console.error('Usage: npm run capture:feed -- [record|summarize]');
  process.exitCode = 1;
};

void main();
