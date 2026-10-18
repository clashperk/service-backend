# Decisions

## 2026-10-18 — Current war falls back to CWL and checks only the last two rounds
Decided by: Claude, pending Suvajit's review. `/currentwar` says `notInWar` during CWL and 403 for a private war log, while CWL round wars stay public, so the endpoint falls back to the league group either way. Only the last two started rounds are fetched (at most 8 round wars): the newest is usually in preparation and the one before in war. The live season in progress has only `trophies`, so `legendStatistics.currentSeason` has its own DTO with optional `id` and `rank`.

## 2026-10-18 — Linking for another user follows the unlink rule
Decided by: Suvajit (as specified). Only admins or verified Leader/Co-Leaders of the player's current clan may link a tag to another user, the same check `DELETE /links/:playerTag` uses. The `manage:links` role alone no longer allows it; the bot is unaffected because the API-key user is ADMIN.

## 2026-10-11 — Capital raids endpoint ported from v1 with two changes
Decided by: Claude, pending Suvajit's review. Sorts by `weekId` (covered by the `{ tag, weekId }` index) instead of v1's `_id` sort with `allowDiskUse`; wraps results in `{ items }` to match the other clans endpoints instead of v1's bare array, so v1 callers need a one-line change.
