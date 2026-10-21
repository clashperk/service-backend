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
  return ids;
};
