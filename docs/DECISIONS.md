# Decisions

## 2026-10-18 — One game calendar for the api
Decided by: Claude, pending Suvajit's review. `events/game-calendar.ts` holds the date rules the bot uses in `guild-events-handler.ts`: Clan Games 22nd–28th 08:00 UTC, CWL from the 1st 08:00 UTC (2-day signup, 9 days in all), raid weekends Friday–Monday 07:00 UTC, season end from `Season.getSeason`. Supercell can now run more than one CWL a month, so the CWL dates are the usual schedule, not a guarantee. The Clan Games member cap is 10,000 (Suvajit); the bot's `getClanGamesMaxPoints` still returns 4,000/5,000.

## 2026-10-18 — Current war falls back to CWL and checks only the last two rounds
Decided by: Claude, pending Suvajit's review. `/currentwar` says `notInWar` during CWL and 403 for a private war log, while CWL round wars stay public, so the endpoint falls back to the league group either way. Only the last two started rounds are fetched (at most 8 round wars): the newest is usually in preparation and the one before in war. The live season in progress has only `trophies`, so `legendStatistics.currentSeason` has its own DTO with optional `id` and `rank`.

## 2026-10-18 — Linking for another user follows the unlink rule
Decided by: Suvajit (as specified). Only admins or verified Leader/Co-Leaders of the player's current clan may link a tag to another user, the same check `DELETE /links/:playerTag` uses. The `manage:links` role alone no longer allows it; the bot is unaffected because the API-key user is ADMIN.

## 2026-10-11 — Capital raids endpoint ported from v1 with two changes
Decided by: Claude, pending Suvajit's review. Sorts by `weekId` (covered by the `{ tag, weekId }` index) instead of v1's `_id` sort with `allowDiskUse`; wraps results in `{ items }` to match the other clans endpoints instead of v1's bare array, so v1 callers need a one-line change.
