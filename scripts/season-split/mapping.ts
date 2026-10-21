import { Util } from 'clashofclans.js';

export interface SeasonIdMapping {
  legacyId: string;
  seasonId: string;
  startTime: Date;
  endTime: Date;
}

/** First legacy id written by the 28-day season code (the 2025-08-25 transition season). */
export const FIRST_28_DAY_ID = '2025-09';

/** Rank snapshots before this were taken on the old last-Monday resets, so they keep their labels. */
export const FIRST_28_DAY_RANK_ID = '2025-11';

export const isLegacyId = (id: string) => /^\d{4}-\d{2}$/.test(id);

export const mapLegacyId = (legacyId: string): SeasonIdMapping => {
  const { id, startTime, endTime } = Util.getLeagueSeasonById(legacyId);
  return { legacyId, seasonId: id, startTime, endTime };
};

let selected: Set<string> | null = null;

/** Limits every step to these legacy ids (--ids), e.g. only the current season while writers are paused. */
export const selectIds = (ids: string[]) => {
  if (ids.some((id) => !isLegacyId(id)))
    throw new Error(`--ids takes legacy YYYY-MM ids, got ${ids.join(',')}`);
  selected = new Set(ids);
};

export const isSelected = (legacyId: string) => !selected || selected.has(legacyId);

/** Every legacy 28-day id, ignoring --ids. */
export const legacyIdsFromAll = () => {
  const saved = selected;
  selected = null;
  try {
    return legacyIdsFrom(FIRST_28_DAY_ID);
  } finally {
    selected = saved;
  }
};

/** Legacy ids from the one the old code writes now back to `from`, newest first. */
export const legacyIdsFrom = (from: string): string[] => {
  const current = Util.getSeason().seasonId;
  const ids: string[] = [];
  for (
    let month = Util.getMonthById(from);
    month.id <= current;
    month = Util.getMonth(month.endTime)
  ) {
    ids.unshift(month.id);
  }
  return ids.filter(isSelected);
};
