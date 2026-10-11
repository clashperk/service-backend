# Decisions

## 2026-10-11 — Capital raids endpoint ported from v1 with two changes
Decided by: Claude, pending Suvajit's review. Sorts by `weekId` (covered by the `{ tag, weekId }` index) instead of v1's `_id` sort with `allowDiskUse`; wraps results in `{ items }` to match the other clans endpoints instead of v1's bare array, so v1 callers need a one-line change.
