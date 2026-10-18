# Decisions

## 2026-10-18 — Linking for another user follows the unlink rule
Decided by: Suvajit (as specified). Only admins or verified Leader/Co-Leaders of the player's current clan may link a tag to another user, the same check `DELETE /links/:playerTag` uses. The `manage:links` role alone no longer allows it; the bot is unaffected because the API-key user is ADMIN.

## 2026-10-11 — Capital raids endpoint ported from v1 with two changes
Decided by: Claude, pending Suvajit's review. Sorts by `weekId` (covered by the `{ tag, weekId }` index) instead of v1's `_id` sort with `allowDiskUse`; wraps results in `{ items }` to match the other clans endpoints instead of v1's bare array, so v1 callers need a one-line change.
