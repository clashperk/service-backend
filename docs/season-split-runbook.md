# Season split runbook (2026-10-31)

Renames the stored 28-day `YYYY-MM` season ids to start dates (`2026-11` → `2026-10-05`), so that from 2026-11-01 `YYYY-MM` means a calendar month again. The full plan is `docs/season-split-plan.md` in the bot repo.

Script: `npm run season-split -- <step> [--apply]`, using `MONGODB_URL`, `MONGODB_DATABASE` and `CLICKHOUSE_*` from `.env`.

- Without `--apply`, a write step only prints what it would do. ClickHouse also runs read-only then.
- `plan` and `verify` never write.
- Every step goes newest to oldest.

## What changes

| Store | Change |
|---|---|
| `LegendAttacks.seasonId`, `PlayerSeasons.season` | ids `2025-09` … current → start dates |
| `PlayerRanks`, `ClanRanks`, `CapitalRanks` `.season` | ids `2025-11` … current → start dates. Older snapshots were taken on the old last-Monday resets and keep their labels |
| `Players.seasons.<key>` | same keys renamed (`$rename`) |
| `PlayerLeagueSeasons` (new) | unique `{tag, seasonId}` and `{seasonId}` indexes, plus trophies backfilled from every `PlayerSeasons` doc (legacy ids mapped too) |
| `SeasonIdMap` (new) | the mapping, plus a `rename-complete` marker that stops a second rename |
| CH `battle_logs` | default → start date. Existing ids rewritten one season and month partition at a time |
| CH `legend_players`, `legend_players_projected` | rebuilt `PARTITION BY` season (so duplicates finally merge), latest row per player kept, rows dated 2070 dropped. The MV is dropped and recreated around the swap |
| CH `legend_players_ranked(_projected)` | rebuilt with start-date partitions |

**Backups:**
- Mongo: `<collection>_bak_season_split`, holding only `_id` plus the id field.
- ClickHouse: `battle_logs_bak_season_split`, made from hard-linked partitions, so it's cheap.
- The rebuilt ClickHouse tables keep their old copy under the same suffix.

Drop the backups after a week of clean reads.

## Before the window

1. Deploy these, so that each one writes start dates once switched on:
   - backend worker (#52) with `SEASON_SPLIT` **off**;
   - the backend API;
   - the Go legend and battle-log trackers;
   - the bot.

   **Not done yet:**
   - Go `LegendAttacks.seasonId` / `legend_players.seasonId`.
   - The API's legend tasks (`REPLACE PARTITION`, `Util.getSeasonId()`) and its battle-log leaderboard `seasonId` regex.
   - The bot's readers.
2. `npm run season-split -- plan`. It must end `plan: ok`; any "already has <start date>" is a collision to resolve first.

## Window (Oct 31, before 2026-11-01 00:00 UTC)

1. Pause every writer:
   - backend worker trackers;
   - the API cron (`CRONJOB_ENABLED=0`; the `*/15` legend ranking job writes `legend_players_ranked`);
   - Go legend and battle-log trackers.
2. Run the steps:
   1. `npm run season-split -- plan`
   2. `npm run season-split -- backup --apply`
   3. `npm run season-split -- mongo --apply`. A duplicate-key error stops it: inspect, never retry with upsert.
   4. `npm run season-split -- league --apply`
   5. `npm run season-split -- clickhouse --apply`
   6. `npm run season-split -- verify`. It must end `verify: ok`.
3. Set `SEASON_SPLIT=1` on the worker, switch the Go trackers and the API to start-date ids, then resume all writers.

Each write step is safe to run again: finished renames and rebuilt tables are skipped. The exception is `mongo` after it has completed, which refuses.

## Rollback

Only while the writers are still paused:

```bash
npm run season-split -- rollback --apply
```

What it does:
- **Mongo:** restores the ids from the backups and clears the marker.
- **ClickHouse:** swaps the rebuilt tables back. The split versions are kept as `<table>_split_rolled_back`.
- **`battle_logs`:** turns its ids back into `YYYY-MM` and restores the old default.

`PlayerLeagueSeasons` is left in place; drop it by hand if needed.

## Known gaps carried over

These were already wrong before the migration; it neither fixes nor worsens them:
- `legend_players` 2025-10 rows start 2025-09-29, and 2025-10 / 2025-11 overlap between 10-27 and 11-03.
- `PlayerSeasons` docs written under the previous season's id on 2026-06-27 → 07-07 and 2026-08-01/02.
