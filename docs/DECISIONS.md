# Decisions

## 2026-10-18 — Clan activity is one query over three ClickHouse tables
Decided by: Claude, pending Suvajit's review. Town Hall upgrades come from `clan_member_event_logs`, clan milestones from `clan_event_logs` and joins/leaves from `player_activities`, merged with `UNION ALL` in one query so Home can ask for up to 10 clans at once (POST, because of the tag list; cached 5 min by body). `player_activities` has no names, so players are named from `Players` and clans from `global_clans`. League ids are named from the Clash API's war and capital league lists, fetched once per process. Promotions and demotions are not tracked anywhere yet, so they aren't in the feed.

The `types` filter runs inside the query, before `LIMIT`; filtering on the client would let a busy clan's joins and leaves push every upgrade out of the page.

## 2026-10-18 — One game calendar for the api
Decided by: Claude, pending Suvajit's review. `events/game-calendar.ts` holds the date rules the bot uses in `guild-events-handler.ts`: Clan Games 22nd–28th 08:00 UTC, CWL from the 1st 08:00 UTC (2-day signup, 9 days in all), raid weekends Friday–Monday 07:00 UTC, season end from `Season.getSeason`. Supercell can now run more than one CWL a month, so the CWL dates are the usual schedule, not a guarantee. The Clan Games member cap is 10,000 (Suvajit); the bot's `getClanGamesMaxPoints` still returns 4,000/5,000.

## 2026-10-18 — Current war falls back to CWL and checks only the last two rounds
Decided by: Claude, pending Suvajit's review. `/currentwar` says `notInWar` during CWL and 403 for a private war log, while CWL round wars stay public, so the endpoint falls back to the league group either way. Only the last two started rounds are fetched (at most 8 round wars): the newest is usually in preparation and the one before in war. The live season in progress has only `trophies`, so `legendStatistics.currentSeason` has its own DTO with optional `id` and `rank`.

## 2026-10-18 — Linking for another user follows the unlink rule
Decided by: Suvajit (as specified). Only admins or verified Leader/Co-Leaders of the player's current clan may link a tag to another user, the same check `DELETE /links/:playerTag` uses. The `manage:links` role alone no longer allows it; the bot is unaffected because the API-key user is ADMIN.

## 2026-10-11 — Capital raids endpoint ported from v1 with two changes
Decided by: Claude, pending Suvajit's review. Sorts by `weekId` (covered by the `{ tag, weekId }` index) instead of v1's `_id` sort with `allowDiskUse`; wraps results in `{ items }` to match the other clans endpoints instead of v1's bare array, so v1 callers need a one-line change.

## 2026-10-18 — War list pages by start time, without member lists
Decided by: Claude, pending Suvajit's review. `GET /wars/:clanTag` matches `clan.tag` or `opponent.tag` (both indexed), sorts by `startTime` and pages with `before` instead of skip, so a page stays cheap however deep you go. The sort runs in memory, which is fine: `ClanWars` keeps 36 months, a few hundred wars per clan. The projection drops `members`, which is most of a stored war's size; one war's detail stays on `GET /wars/:clanTag/:warId`.

## 2026-10-18 — CWL seasons come from the clan's own stored wars
Decided by: Claude, pending Suvajit's review. The worker stores only the tracked clan's rounds, not the whole group's, so past seasons can't have standings; live standings stay with `GET /wars/:clanTag/clan-war-leagues/groups`. Seasons are picked with a `$group` on `season` before loading wars, so `limit` bounds the work. Round numbers come from the stored `CWLGroups` doc via `leagueGroupId`; without it `round` and `leagueId` are null rather than guessed from start times.

Standings are a separate per-group endpoint because they need every war in the group (28 for 8 clans), loaded from the game by the war tags `CWLGroups` keeps for all clans. The game serves a season's war tags only until the next CWL (checked 2026-10-18: October loaded, September and older came back empty), so older tables come back with `roundsPlayed: 0`. When wars are missing, the API asks the same archive service the bot uses (`CwlArchiveService`, authenticated with `API_KEY`, which is the bot's `INTERNAL_API_KEY`). A failure there only logs a warning and leaves the table partial. Local `.env` keys get a 401 from the archive, so this is only exercised in production.
