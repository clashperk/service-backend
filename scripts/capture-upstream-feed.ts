#!/usr/bin/env node

/**
 * Collects one exemplar of every distinct `upstream_feed` packet shape.
 *
 * The packets are built inline as untyped objects at each emit site and the
 * shapes are not uniform — the `clan` sub-object alone carries a different
 * field set in almost every op. Reproducing them in Go means knowing the exact
 * shapes, and reading the emit sites is not enough to be sure.
 *
 * Recording everything for a fixed window does not work either: donation and
 * feed packets arrive constantly, but league changes fire at a season boundary,
 * clan games once a month, and town hall upgrades whenever a player finishes
 * one. So this keeps one exemplar per distinct shape and nothing else, which
 * means it can be left running for weeks for the cost of a few KB.
 *
 *   npm run capture:feed -- record [--out FILE] [--redact] [--seconds N]
 *   npm run capture:feed -- summarize [FILE]
 *
 * Restarting resumes: existing shapes are loaded first and only genuinely new
 * ones are appended. With --redact, names and tags are replaced by stable
 * placeholders, which makes the output safe to commit as Go test fixtures.
 */

import 'dotenv/config';

import Redis from 'ioredis';
import { appendFileSync, createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const CHANNEL = 'upstream_feed';
const DEFAULT_OUT = 'upstream-shapes.jsonl';

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

/**
 * A packet's shape signature: every flattened path plus its type. Two packets
 * share a signature when the Go struct that encodes them would be identical.
 */
function signature(packet: unknown): string {
  const fields = new Map<string, FieldStat>();
  walk(packet, '', fields);

  return [...fields]
    .map(([path, stat]) => `${path}:${[...stat.types].sort().join('|')}`)
    .sort()
    .join(',');
}

/**
 * Replaces names and tags with stable placeholders, so the same tag maps to the
 * same value everywhere in a packet and cross-references still line up.
 */
function redact(value: unknown, key = '', seen = new Map<string, string>()): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, key, seen));

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [childKey, redact(child, childKey, seen)]),
    );
  }

  if (typeof value !== 'string') return value;

  const isTag = key === 'tag' || key.endsWith('Tag');
  const isName = key === 'name' || key.endsWith('Name');
  if (!isTag && !isName) return value;

  const existing = seen.get(value);
  if (existing) return existing;

  const placeholder = isTag ? `#TAG${seen.size.toString().padStart(4, '0')}` : `Name ${seen.size}`;
  seen.set(value, placeholder);
  return placeholder;
}

async function record() {
  const out = flag('out', DEFAULT_OUT)!;
  const shouldRedact = process.argv.includes('--redact');
  const seconds = Number(flag('seconds', '0'));

  // Resume: a shape already on disk is not new, so a restart adds nothing.
  const known = new Set<string>();
  if (existsSync(out)) {
    const existing = createInterface({ input: createReadStream(out), crlfDelay: Infinity });
    for await (const line of existing) {
      if (!line.trim()) continue;
      try {
        known.add(JSON.parse(line).signature);
      } catch {
        continue;
      }
    }
    console.log(`Resuming with ${known.size} shapes already recorded in ${out}`);
  }

  const redis = new Redis(requireEnv('REDIS_URL'));
  const byOp = new Map<number, number>();
  let seen = 0;

  const finish = async (reason: string) => {
    await redis.quit();
    console.log(`\n${reason}. ${known.size} distinct shapes from ${seen} packets -> ${out}`);
    for (const [op, count] of [...byOp].sort((a, b) => a[0] - b[0])) {
      console.log(
        `  ${String(op).padStart(6)} ${(OP_NAMES[op] ?? '?').padEnd(18)} ${count} shapes`,
      );
    }

    const missing = Object.entries(OP_NAMES).filter(([op]) => !byOp.has(Number(op)));
    if (missing.length) {
      console.log(`\nNot seen yet: ${missing.map(([, name]) => name).join(', ')}`);
      console.log('Rare ops need a longer run; league changes need a season boundary.');
    }

    console.log(`\nNext: npm run capture:feed -- summarize ${out}`);
    process.exit(0);
  };

  await redis.subscribe(CHANNEL);
  console.log(
    `Subscribed to ${CHANNEL}. Recording distinct shapes${seconds ? ` for ${seconds}s` : ' until interrupted'}...`,
  );

  redis.on('message', (_channel, message) => {
    seen += 1;

    let packet: Record<string, unknown>;
    try {
      packet = JSON.parse(message);
    } catch {
      return;
    }

    const sig = signature(packet);
    if (known.has(sig)) return;
    known.add(sig);

    const op = typeof packet.op === 'number' ? packet.op : -1;
    byOp.set(op, (byOp.get(op) ?? 0) + 1);

    appendFileSync(
      out,
      JSON.stringify({
        op,
        signature: sig,
        firstSeen: new Date().toISOString(),
        packet: shouldRedact ? redact(packet) : packet,
      }) + '\n',
    );

    console.log(
      `  new shape #${known.size} — op ${op} ${OP_NAMES[op] ?? '?'} (after ${seen} packets)`,
    );
  });

  if (seconds) setTimeout(() => void finish('Time is up'), seconds * 1000);
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

    // Shape files wrap the exemplar; a raw corpus line is the packet itself.
    const inner = (packet.packet ?? packet) as Record<string, unknown>;

    const op = typeof inner.op === 'number' ? inner.op : -1;
    const entry = byOp.get(op) ?? { packets: 0, fields: new Map<string, FieldStat>() };
    entry.packets += 1;
    walk(inner, '', entry.fields);
    byOp.set(op, entry);
  }

  for (const [op, entry] of [...byOp].sort((a, b) => a[0] - b[0])) {
    console.log(`\n${'='.repeat(78)}`);
    console.log(`op ${op} — ${OP_NAMES[op] ?? 'UNKNOWN'} — ${entry.packets} distinct shapes`);
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
  console.log('A field below 100% appears in some shapes of this op but not all,');
  console.log('so it needs omitempty in Go. Everything at 100% must always be');
  console.log('emitted, including zero values and empty arrays.');
}

const main = async () => {
  const command = process.argv[2];
  if (command === 'record') return record();
  if (command === 'summarize') return summarize();

  console.error('Usage: npm run capture:feed -- [record|summarize]');
  process.exitCode = 1;
};

void main();
