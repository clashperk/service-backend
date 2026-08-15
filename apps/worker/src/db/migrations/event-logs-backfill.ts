import { ClanEventRecord, ClanMemberEventRecord } from '../../tasks/bulk-writer.service';

/** Shape of the legacy Elasticsearch documents these tables replace. */
export interface LegacyClanEventDoc {
  tag?: string;
  name?: string;
  op?: string;
  value?: number | string | null;
  diff?: number | string | null;
  created_at?: string | number | null;
}

export interface LegacyClanMemberEventDoc extends LegacyClanEventDoc {
  clan_tag?: string;
  clan_name?: string;
}

export type BackfilledClanEvent = ClanEventRecord & { diff: number };
export type BackfilledClanMemberEvent = ClanMemberEventRecord & { diff: number };

const toNumber = (value: number | string | null | undefined) => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
};

/** Returns unix seconds, or null when the source timestamp is missing or unparseable. */
export const toUnixSeconds = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return null;

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.floor(time / 1000) : null;
};

/**
 * Legacy documents are not guaranteed to be well formed - the index was written to over years by
 * code that has since changed. A document missing a tag or a usable timestamp is dropped rather
 * than written with a bogus default, and the caller reports the count.
 */
export const mapClanEvent = (doc: LegacyClanEventDoc): BackfilledClanEvent | null => {
  const createdAt = toUnixSeconds(doc.created_at);
  if (!doc.tag || !doc.op || createdAt === null) return null;

  return {
    tag: doc.tag,
    name: doc.name ?? '',
    op: doc.op as ClanEventRecord['op'],
    value: toNumber(doc.value),
    diff: toNumber(doc.diff),
    createdAt,
  };
};

export const mapClanMemberEvent = (
  doc: LegacyClanMemberEventDoc,
): BackfilledClanMemberEvent | null => {
  const createdAt = toUnixSeconds(doc.created_at);
  if (!doc.tag || !doc.op || createdAt === null) return null;

  return {
    tag: doc.tag,
    name: doc.name ?? '',
    clanTag: doc.clan_tag ?? '',
    clanName: doc.clan_name ?? '',
    op: doc.op as ClanMemberEventRecord['op'],
    value: toNumber(doc.value),
    diff: toNumber(doc.diff),
    createdAt,
  };
};

export const BACKFILL_SOURCES = [
  { index: 'clan_event_logs', table: 'clan_event_logs', map: mapClanEvent },
  {
    index: 'clan_member_event_logs',
    table: 'clan_member_event_logs',
    map: mapClanMemberEvent,
  },
] as const;
