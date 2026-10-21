import { Db, MongoServerError, ObjectId } from 'mongodb';
import { BACKUP_SUFFIX, Context } from './context';
import {
  FIRST_28_DAY_ID,
  FIRST_28_DAY_RANK_ID,
  legacyIdsFrom,
  legacyIdsFromAll,
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

const PLAYER_SEASONS = 'PlayerSeasons';
const SEASON_ID_MAP = 'SeasonIdMap';
const BATCH_SIZE = 50_000;
// Set once every legacy id is renamed; a later run has nothing left to do and is refused.
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

  for (const { collection } of TARGETS) {
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

  // Ids renamed in an earlier run (e.g. the current season during the pause) are skipped.
  const done = new Set(
    (
      await db
        .collection<{ legacyId: string }>(SEASON_ID_MAP)
        .find({ renamedAt: { $exists: true } })
        .toArray()
    ).map((doc) => doc.legacyId),
  );
  for (const legacyId of done) console.log(`skip: ${legacyId} was already renamed`);
  const all = mappingsFrom(FIRST_28_DAY_ID).filter((m) => !done.has(m.legacyId));
  if (!all.length) {
    console.log('nothing to rename');
    return;
  }
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
    for (const { legacyId, seasonId } of mappingsFrom(target.from).filter(
      (m) => !done.has(m.legacyId),
    )) {
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

  if (ctx.problems.length) return;
  const renamed = all.map((m) => m.legacyId);
  await ctx.write(`record ${renamed.join(', ')} as renamed`, () =>
    db
      .collection(SEASON_ID_MAP)
      .updateMany({ legacyId: { $in: renamed } }, { $set: { renamedAt: new Date() } }),
  );

  const remaining = legacyIdsFromAll().filter((id) => !done.has(id) && !renamed.includes(id));
  if (ctx.apply && !remaining.length) {
    await ctx.write(`every id is renamed; mark the rename complete in ${SEASON_ID_MAP}`, () =>
      db
        .collection<{ _id: string; at: Date }>(SEASON_ID_MAP)
        .insertOne({ _id: RENAME_MARKER, at: new Date() }),
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
};

/**
 * Turns every renamed start date back into its legacy id, using the stored mapping, so ids renamed
 * online without a backup are covered too. Run with the writers paused and SEASON_SPLIT off.
 */
export const rollbackMongo = async (db: Db, ctx: Context) => {
  const renamed = await db
    .collection<{ legacyId: string; seasonId: string }>(SEASON_ID_MAP)
    .find({ renamedAt: { $exists: true } })
    .sort({ legacyId: -1 })
    .toArray();

  for (const { legacyId, seasonId } of renamed) {
    for (const target of TARGETS.filter((t) => legacyId >= t.from)) {
      const coll = db.collection(target.collection);
      const pending = await coll.countDocuments({ [target.field]: seasonId });
      if (!pending) continue;

      await ctx.write(
        `${target.collection}.${target.field}: ${seasonId} -> ${legacyId} (${pending} docs)`,
        () =>
          (target.collection === PLAYER_SEASONS
            ? renameInBatches(db, target.collection, target.field, seasonId, legacyId)
            : coll.updateMany({ [target.field]: seasonId }, { $set: { [target.field]: legacyId } })
          ).catch(failOnDuplicate(target.collection, seasonId, legacyId)),
      );
    }
    await ctx.write(`record ${legacyId} as not renamed`, () =>
      db.collection(SEASON_ID_MAP).updateOne({ legacyId }, { $unset: { renamedAt: '' } }),
    );
  }

  await ctx.write('clear the rename marker so the rename can run again', () =>
    db.collection<{ _id: string }>(SEASON_ID_MAP).deleteOne({ _id: RENAME_MARKER }),
  );
};
