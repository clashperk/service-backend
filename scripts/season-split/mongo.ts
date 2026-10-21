import { Db, MongoServerError, ObjectId } from 'mongodb';
import { BACKUP_SUFFIX, Context } from './context';
import {
  FIRST_28_DAY_ID,
  FIRST_28_DAY_RANK_ID,
  isLegacyId,
  legacyIdsFrom,
  mapLegacyId,
  SeasonIdMapping,
} from './mapping';

interface Target {
  collection: string;
  field: string;
  from: string;
}

const TARGETS: Target[] = [
  { collection: 'LegendAttacks', field: 'seasonId', from: FIRST_28_DAY_ID },
  { collection: 'PlayerSeasons', field: 'season', from: FIRST_28_DAY_ID },
  { collection: 'PlayerRanks', field: 'season', from: FIRST_28_DAY_RANK_ID },
  { collection: 'ClanRanks', field: 'season', from: FIRST_28_DAY_RANK_ID },
  { collection: 'CapitalRanks', field: 'season', from: FIRST_28_DAY_RANK_ID },
];

const PLAYERS = 'Players';
const PLAYER_SEASONS = 'PlayerSeasons';
const PLAYER_LEAGUE_SEASONS = 'PlayerLeagueSeasons';
const SEASON_ID_MAP = 'SeasonIdMap';
const BATCH_SIZE = 50_000;
// After the rename, YYYY-MM ids are calendar months again, so a second rename would corrupt them.
const RENAME_MARKER = 'rename-complete';

const renameDone = async (db: Db) =>
  Boolean(await db.collection<{ _id: string }>(SEASON_ID_MAP).findOne({ _id: RENAME_MARKER }));

const mappingsFrom = (from: string) => legacyIdsFrom(from).map(mapLegacyId);

const exists = async (db: Db, name: string) =>
  (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0;

const countBy = async (db: Db, collection: string, field: string, values: string[]) => {
  const rows = await db
    .collection(collection)
    .aggregate<{ _id: string; n: number }>([
      { $match: { [field]: { $in: values } } },
      { $group: { _id: `$${field}`, n: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((row) => [row._id, row.n]));
};

/** Counts how many Players docs carry each `seasons.<key>`. One scan of the collection. */
const countSeasonKeys = async (db: Db, collection: string, keys: string[]) => {
  const rows = await db
    .collection(collection)
    .aggregate<{ _id: string; n: number }>(
      [
        { $match: { $or: keys.map((key) => ({ [`seasons.${key}`]: { $exists: true } })) } },
        { $project: { keys: { $map: { input: { $objectToArray: '$seasons' }, in: '$$this.k' } } } },
        { $unwind: '$keys' },
        { $match: { keys: { $in: keys } } },
        { $group: { _id: '$keys', n: { $sum: 1 } } },
      ],
      { allowDiskUse: true },
    )
    .toArray();
  return new Map(rows.map((row) => [row._id, row.n]));
};

const printCounts = (
  label: string,
  mappings: SeasonIdMapping[],
  legacy: Map<string, number>,
  renamed: Map<string, number>,
) => {
  console.log(`\n${label}`);
  for (const { legacyId, seasonId } of mappings) {
    console.log(
      `  ${legacyId} (${legacy.get(legacyId) ?? 0}) -> ${seasonId} (${renamed.get(seasonId) ?? 0})`,
    );
  }
};

export const planMongo = async (db: Db, ctx: Context) => {
  for (const target of TARGETS) {
    const mappings = mappingsFrom(target.from);
    const counts = await countBy(db, target.collection, target.field, [
      ...mappings.map((m) => m.legacyId),
      ...mappings.map((m) => m.seasonId),
    ]);
    printCounts(`${target.collection}.${target.field}`, mappings, counts, counts);
    for (const { seasonId } of mappings) {
      if (counts.get(seasonId)) ctx.problem(`${target.collection} already has ${seasonId}`);
    }
  }

  const mappings = mappingsFrom(FIRST_28_DAY_ID);
  const keys = await countSeasonKeys(db, PLAYERS, [
    ...mappings.map((m) => m.legacyId),
    ...mappings.map((m) => m.seasonId),
  ]);
  printCounts(`${PLAYERS}.seasons.<key>`, mappings, keys, keys);
  for (const { seasonId } of mappings) {
    if (keys.get(seasonId)) ctx.problem(`${PLAYERS} already has seasons.${seasonId}`);
  }

  console.log(
    `\n${PLAYER_LEAGUE_SEASONS}: ${await db.collection(PLAYER_LEAGUE_SEASONS).estimatedDocumentCount()} docs`,
  );
  for (const { collection } of [...TARGETS, { collection: PLAYERS }]) {
    if (await exists(db, collection + BACKUP_SUFFIX)) {
      console.log(`  backup ${collection + BACKUP_SUFFIX} exists`);
    }
  }
};

export const backupMongo = async (db: Db, ctx: Context) => {
  for (const target of TARGETS) {
    const name = target.collection + BACKUP_SUFFIX;
    if (await exists(db, name)) {
      console.log(`skip: ${name} exists; the first backup is kept`);
      continue;
    }
    const legacyIds = legacyIdsFrom(target.from);
    await ctx.write(
      `back up ${target.collection}.${target.field} for ${legacyIds.length} ids to ${name}`,
      () =>
        db
          .collection(target.collection)
          .aggregate([
            { $match: { [target.field]: { $in: legacyIds } } },
            { $project: { [target.field]: 1 } },
            { $out: name },
          ])
          .toArray(),
    );
  }

  const name = PLAYERS + BACKUP_SUFFIX;
  if (await exists(db, name)) {
    console.log(`skip: ${name} exists; the first backup is kept`);
    return;
  }
  const legacyIds = legacyIdsFrom(FIRST_28_DAY_ID);
  await ctx.write(`back up ${PLAYERS}.seasons to ${name}`, () =>
    db
      .collection(PLAYERS)
      .aggregate(
        [
          { $match: { $or: legacyIds.map((id) => ({ [`seasons.${id}`]: { $exists: true } })) } },
          { $project: { seasons: 1 } },
          { $out: name },
        ],
        { allowDiskUse: true },
      )
      .toArray(),
  );
};

const renameInBatches = async (
  db: Db,
  collection: string,
  field: string,
  from: string,
  to: string,
) => {
  const coll = db.collection(collection);
  let renamed = 0;
  for (;;) {
    const ids = await coll
      .find({ [field]: from }, { projection: { _id: 1 } })
      .limit(BATCH_SIZE)
      .map((doc) => doc._id)
      .toArray();
    if (!ids.length) return renamed;

    const { modifiedCount } = await coll.updateMany(
      { _id: { $in: ids }, [field]: from },
      { $set: { [field]: to } },
    );
    if (!modifiedCount) throw new Error(`${collection}: ${from} -> ${to} stopped making progress`);
    renamed += modifiedCount;
    console.log(`  ${collection} ${from} -> ${to}: ${renamed}`);
  }
};

const failOnDuplicate = (collection: string, from: string, to: string) => (err: unknown) => {
  if (err instanceof MongoServerError && err.code === 11000) {
    throw new Error(
      `${collection}: renaming ${from} -> ${to} hit a duplicate key. Stop and inspect; do not retry with upsert.`,
    );
  }
  throw err;
};

export const renameMongo = async (db: Db, ctx: Context) => {
  if (await renameDone(db)) {
    ctx.problem(
      `the rename already completed (${SEASON_ID_MAP} ${RENAME_MARKER}); refusing to run it again`,
    );
    return;
  }

  const all = mappingsFrom(FIRST_28_DAY_ID);
  await ctx.write(`store ${all.length} mappings in ${SEASON_ID_MAP}`, () =>
    db.collection(SEASON_ID_MAP).bulkWrite(
      all.map((mapping) => ({
        updateOne: {
          filter: { legacyId: mapping.legacyId },
          update: { $set: mapping },
          upsert: true,
        },
      })),
    ),
  );

  for (const target of TARGETS) {
    const coll = db.collection(target.collection);
    for (const { legacyId, seasonId } of mappingsFrom(target.from)) {
      const pending = await coll.countDocuments({ [target.field]: legacyId });
      if (!pending) continue;

      await ctx.write(
        `${target.collection}.${target.field}: ${legacyId} -> ${seasonId} (${pending} docs)`,
        () =>
          (target.collection === PLAYER_SEASONS
            ? renameInBatches(db, target.collection, target.field, legacyId, seasonId)
            : coll.updateMany({ [target.field]: legacyId }, { $set: { [target.field]: seasonId } })
          ).catch(failOnDuplicate(target.collection, legacyId, seasonId)),
      );
    }
  }

  const players = db.collection(PLAYERS);
  for (const { legacyId, seasonId } of all) {
    const from = `seasons.${legacyId}`;
    const to = `seasons.${seasonId}`;
    // $rename overwrites an existing key, so a doc holding both would lose data.
    const conflicts = await players.countDocuments({
      [from]: { $exists: true },
      [to]: { $exists: true },
    });
    if (conflicts) {
      ctx.problem(`${PLAYERS}: ${conflicts} docs have both ${from} and ${to}; skipped`);
      continue;
    }
    await ctx.write(`${PLAYERS}: rename ${from} -> ${to}`, () =>
      players.updateMany({ [from]: { $exists: true } }, { $rename: { [from]: to } }),
    );
  }

  if (ctx.problems.length) return;
  await ctx.write(`mark the rename complete in ${SEASON_ID_MAP}`, () =>
    db
      .collection<{ _id: string; at: Date }>(SEASON_ID_MAP)
      .insertOne({ _id: RENAME_MARKER, at: new Date() }),
  );
};

/** The id a PlayerSeasons doc's trophies belong to, or null for calendar-month docs. */
const leagueSeasonIdOf = (season: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(season)) return season;
  if (isLegacyId(season) && season < FIRST_28_DAY_ID) return mapLegacyId(season).seasonId;
  return null;
};

export const backfillLeagueSeasons = async (db: Db, ctx: Context) => {
  const target = db.collection(PLAYER_LEAGUE_SEASONS);
  await ctx.write(
    `create unique {tag, seasonId} and {seasonId} indexes on ${PLAYER_LEAGUE_SEASONS}`,
    () =>
      Promise.all([
        target.createIndex({ tag: 1, seasonId: 1 }, { unique: true }),
        target.createIndex({ seasonId: 1 }),
      ]),
  );

  if (!(await renameDone(db))) {
    ctx.problem('run the mongo step first: PlayerSeasons still holds 28-day YYYY-MM ids');
    if (ctx.apply) return;
  }

  const seasons = (await db.collection(PLAYER_SEASONS).distinct('season')) as string[];
  for (const season of seasons.sort().reverse()) {
    const seasonId = leagueSeasonIdOf(season);
    if (!seasonId) continue;

    await ctx.write(
      `copy ${PLAYER_SEASONS} ${season} trophies into ${PLAYER_LEAGUE_SEASONS} ${seasonId}`,
      () =>
        db
          .collection(PLAYER_SEASONS)
          .aggregate(
            [
              { $match: { season } },
              {
                $project: {
                  _id: 0,
                  tag: 1,
                  name: 1,
                  seasonId: { $literal: seasonId },
                  trophies: 1,
                  versusTrophies: 1,
                  createdAt: 1,
                  updatedAt: 1,
                },
              },
              // Docs the worker already wrote for this season are newer, so they win.
              {
                $merge: {
                  into: PLAYER_LEAGUE_SEASONS,
                  on: ['tag', 'seasonId'],
                  whenMatched: 'keepExisting',
                  whenNotMatched: 'insert',
                },
              },
            ],
            { allowDiskUse: true },
          )
          .toArray(),
    );
  }
};

export const verifyMongo = async (db: Db, ctx: Context) => {
  for (const target of TARGETS) {
    const backup = target.collection + BACKUP_SUFFIX;
    const mappings = mappingsFrom(target.from);
    const before = (await exists(db, backup))
      ? await countBy(
          db,
          backup,
          target.field,
          mappings.map((m) => m.legacyId),
        )
      : new Map<string, number>();
    const legacyLeft = await countBy(
      db,
      target.collection,
      target.field,
      mappings.map((m) => m.legacyId),
    );
    const after = await countBy(
      db,
      target.collection,
      target.field,
      mappings.map((m) => m.seasonId),
    );
    printCounts(`${target.collection}.${target.field} (backup -> live)`, mappings, before, after);

    for (const { legacyId, seasonId } of mappings) {
      if (legacyLeft.get(legacyId)) ctx.problem(`${target.collection} still has ${legacyId}`);
      if ((after.get(seasonId) ?? 0) < (before.get(legacyId) ?? 0)) {
        ctx.problem(
          `${target.collection} has fewer ${seasonId} docs than the backup had ${legacyId}`,
        );
      }
    }

    if (before.size) {
      const sample = await db
        .collection(backup)
        .aggregate<{ _id: ObjectId } & Record<string, string>>([{ $sample: { size: 20 } }])
        .toArray();
      for (const doc of sample) {
        const live = await db.collection(target.collection).findOne({ _id: doc._id });
        const expected = mapLegacyId(doc[target.field]).seasonId;
        if (live?.[target.field] !== expected) {
          ctx.problem(
            `${target.collection} ${String(doc._id)}: expected ${expected}, got ${live?.[target.field]}`,
          );
        }
      }
    }
  }

  const mappings = mappingsFrom(FIRST_28_DAY_ID);
  const keys = await countSeasonKeys(db, PLAYERS, [
    ...mappings.map((m) => m.legacyId),
    ...mappings.map((m) => m.seasonId),
  ]);
  printCounts(`${PLAYERS}.seasons.<key> (live)`, mappings, keys, keys);
  for (const { legacyId } of mappings) {
    if (keys.get(legacyId)) ctx.problem(`${PLAYERS} still has seasons.${legacyId}`);
  }

  const leagueCounts = await db
    .collection(PLAYER_LEAGUE_SEASONS)
    .aggregate<{ _id: string; n: number }>([
      { $group: { _id: '$seasonId', n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  console.log(`\n${PLAYER_LEAGUE_SEASONS}`);
  for (const { _id, n } of leagueCounts) console.log(`  ${_id}: ${n}`);
  if (!leagueCounts.length) ctx.problem(`${PLAYER_LEAGUE_SEASONS} is empty`);
};

/** Restores the renamed ids from the backups. Run only while the writers are still paused. */
export const rollbackMongo = async (db: Db, ctx: Context) => {
  for (const { collection, field } of [...TARGETS, { collection: PLAYERS, field: 'seasons' }]) {
    const backup = collection + BACKUP_SUFFIX;
    if (!(await exists(db, backup))) {
      console.log(`skip: no ${backup}`);
      continue;
    }
    await ctx.write(`restore ${collection}.${field} from ${backup}`, () =>
      db
        .collection(backup)
        .aggregate(
          [
            { $project: { [field]: 1 } },
            {
              $merge: {
                into: collection,
                on: '_id',
                whenMatched: [{ $set: { [field]: `$$new.${field}` } }],
                whenNotMatched: 'discard',
              },
            },
          ],
          { allowDiskUse: true },
        )
        .toArray(),
    );
  }

  await ctx.write('clear the rename marker so the rename can run again', () =>
    db.collection<{ _id: string }>(SEASON_ID_MAP).deleteOne({ _id: RENAME_MARKER }),
  );
};
