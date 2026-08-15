import { mapClanEvent, mapClanMemberEvent, toUnixSeconds } from './event-logs-backfill';

describe('event log backfill mapping', () => {
  describe('toUnixSeconds', () => {
    it('converts an ISO timestamp to unix seconds', () => {
      expect(toUnixSeconds('2025-02-10T02:20:05.000Z')).toBe(1739154005);
    });

    it('accepts epoch milliseconds', () => {
      expect(toUnixSeconds(1739154005000)).toBe(1739154005);
    });

    it('returns null for missing or unparseable values', () => {
      expect(toUnixSeconds(null)).toBeNull();
      expect(toUnixSeconds(undefined)).toBeNull();
      expect(toUnixSeconds('not a date')).toBeNull();
    });
  });

  describe('mapClanEvent', () => {
    it('renames fields to the ClickHouse column names', () => {
      expect(
        mapClanEvent({
          tag: '#2PP',
          name: 'Clan',
          op: 'CLAN_LEVEL_UP',
          value: 12,
          created_at: '2025-02-10T02:20:05.000Z',
        }),
      ).toEqual({
        tag: '#2PP',
        name: 'Clan',
        op: 'CLAN_LEVEL_UP',
        value: 12,
        diff: 0,
        createdAt: 1739154005,
      });
    });

    it('coerces stringified numbers and defaults a missing diff', () => {
      const row = mapClanEvent({
        tag: '#2PP',
        name: 'Clan',
        op: 'WAR_LEAGUE_CHANGE',
        value: '48000018',
        created_at: '2025-02-10T02:20:05.000Z',
      });

      expect(row).toMatchObject({ value: 48000018, diff: 0 });
    });

    it('carries diff through when the legacy document has one', () => {
      const row = mapClanEvent({
        tag: '#2PP',
        name: 'Clan',
        op: 'CLAN_LEVEL_UP',
        value: 12,
        diff: -3,
        created_at: '2025-02-10T02:20:05.000Z',
      });

      expect(row).toMatchObject({ diff: -3 });
    });

    it('drops documents that cannot be written safely', () => {
      const base = { name: 'Clan', op: 'CLAN_LEVEL_UP', value: 1, created_at: '2025-02-10' };

      expect(mapClanEvent({ ...base, tag: undefined })).toBeNull();
      expect(mapClanEvent({ ...base, tag: '#2PP', op: undefined })).toBeNull();
      expect(mapClanEvent({ ...base, tag: '#2PP', created_at: null })).toBeNull();
    });
  });

  describe('mapClanMemberEvent', () => {
    it('renames the clan fields', () => {
      expect(
        mapClanMemberEvent({
          tag: '#ABC',
          name: 'Player',
          clan_tag: '#2PP',
          clan_name: 'Clan',
          op: 'TOWN_HALL_UPGRADE',
          value: 16,
          created_at: '2025-02-10T02:20:05.000Z',
        }),
      ).toEqual({
        tag: '#ABC',
        name: 'Player',
        clanTag: '#2PP',
        clanName: 'Clan',
        op: 'TOWN_HALL_UPGRADE',
        value: 16,
        diff: 0,
        createdAt: 1739154005,
      });
    });

    it('tolerates a legacy document with no clan attached', () => {
      const row = mapClanMemberEvent({
        tag: '#ABC',
        name: 'Player',
        op: 'TOWN_HALL_UPGRADE',
        value: 16,
        created_at: '2025-02-10T02:20:05.000Z',
      });

      expect(row).toMatchObject({ clanTag: '', clanName: '' });
    });
  });
});
