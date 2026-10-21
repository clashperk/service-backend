# Season split runbook

Renames the stored 28-day `YYYY-MM` season ids to the season's start date (`2026-11` → `2026-10-05`). The `YYYY-MM` label advanced a month per 28-day season, so it no longer matched the dates it covered. The full plan is `docs/season-split-plan.md` in the bot repo.

## Ids after the split

| Kind | Format | Stores |
|---|---|---|
| 28-day league season | `YYYY-MM-DD` (start date) | Mongo `PlayerSeasons.season`, `LegendAttacks.seasonId`, `PlayerRanks` / `ClanRanks` / `CapitalRanks` `.season`; CH `battle_logs.battle_season`, `legend_players.seasonId`, `legend_players_projected` / `legend_players_ranked` / `legend_players_ranked_projected` `.battle_season` |
| Calendar month | `YYYY-MM` (unchanged) | `Players.seasons.<key>` (activity), `ClanWars`, `ClanGames`, `ClanGamesPoints`, `CapitalContributions`, `CWLGroups` |

- Ids from before the 28-day seasons keep their labels: `PlayerSeasons` before `2025-09`, ranks before `2025-11`.
- Every service reads `SEASON_SPLIT`. Off means today's ids; `SEASON_SPLIT=1` means the ids above.

## Script

`npm run season-split -- <step> [--apply] [--ids=2026-11,2026-10]`, using `MONGODB_URL`, `MONGODB_DATABASE` and `CLICKHOUSE_*` from `.env`.

| Step | What it does |
|---|---|
| `plan` | Read-only counts per id, and checks that no new id exists yet. |
| `backup` | Mongo: copies `_id` plus the id field to `<collection>_bak_season_split`. CH: hard-links `battle_logs` partitions into `battle_logs_bak_season_split`. The first backup is kept. |
| `mongo` | Renames ids newest first (`PlayerSeasons` in 50k batches). It records each renamed id in `SeasonIdMap` and never renames it twice. |
| `clickhouse` | Sets the `battle_logs.battle_season` default to the start date, and rewrites the selected ids one month-partition at a time. Rebuilds the legend tables partitioned by season (latest row per player, 2070 rows dropped), swaps them in with `EXCHANGE`, keeps the old ones as `*_bak_season_split`, and recreates the MV. |
| `verify` | Read-only. Counts against the backups, no old ids left in the selection, 20 sampled docs per collection. |
| `rollback` | Reverses every renamed id from `SeasonIdMap`, swaps the ClickHouse tables back, and restores the old default. |

Without `--apply`, write steps only print what they would do, and ClickHouse runs read-only. `--ids` limits a step to those legacy ids.

## Rollout

1. Deploy the worker, API, Go legend tracker and bot (plus custom bots) with `SEASON_SPLIT` **unset**.
2. `plan`. It must end with `plan: ok`.
3. **Pause** the backend worker and the Go `legend` / `battle-logs` trackers. The API and bot stay up.
4. Current and previous season only:
   1. `backup --apply --ids=2026-11,2026-10`
   2. `mongo --apply --ids=2026-11,2026-10`
   3. `clickhouse --apply --ids=2026-11,2026-10`
   4. `verify --ids=2026-11,2026-10`. It must end with `verify: ok`.
5. Set `SEASON_SPLIT=1`:
   - worker and API: `.env`;
   - Go legend tracker: `.env`;
   - bot: `.env`;
   - custom bots: `SHARED_ENV_SEASON_SPLIT=1` in `docker-service/.env.services.env`, then recreate `docker-service` and call `POST /services/migrate`.

   Restart the services, then run the bot's `npm run deploy`.
6. **Resume** the writers.
7. Online, older seasons: `mongo --apply`, then `clickhouse --apply`, then `verify`.

**If `verify` fails in step 4,** run `rollback --apply` while the writers are still paused and the flag is off.

## Known gaps carried over

These were already wrong before the migration:
- `legend_players` 2025-10 rows start 2025-09-29, and 2025-10 / 2025-11 overlap between 10-27 and 11-03.
- `PlayerSeasons` docs were written under the previous season's id on 2026-06-27 → 07-07 and 2026-08-01/02.
- `Players.seasons.2026-11` holds Oct 5 onward and `2026-10` holds Sep 7 – Oct 5. After the split, both keep receiving their calendar month on top. That's accepted as minor.
