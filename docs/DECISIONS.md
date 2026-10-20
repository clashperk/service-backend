# Decisions

## 2026-10-20 — The bot reloads clan logs on its own
The bot caches clan logs in memory and only reloaded them from `/setup clan-logs`. It now watches `ClanLogs` for setting changes (channel, enabled, role, color) and reloads that clan, so the API just writes the record. Updates to `messageId` or `lastPostedAt`, which the bot makes after every post, don't trigger a reload.

## 2026-10-20 — The API schedules reminders itself
The bot schedules a new reminder for whatever is already running, then picks up later wars on its own. The API does the same on create and edit (current war and the last two CWL rounds, the latest raid weekend, the Clan Games window on the 22nd at 08:00 UTC), and writes the schedule records the bot watches, so no bot change is needed. Edits replace a reminder's schedules, as the bot's `reSchedule` does.

## 2026-10-20 — Reminder webhooks: signed-in, reused, or left to the bot
The dashboard can get a webhook through Discord's `webhook.incoming` sign-in, which works even when the bot can't manage webhooks in that channel. The dashboard swaps the code (it holds the Discord client secret) and sends the webhook; the API checks it belongs to the server and channel. Without one, the API reuses a webhook from another reminder or clan log in the channel, and otherwise saves none: the bot creates one when the reminder first fires. Channels are limited to text and announcement channels in the server, so a reminder can't point the bot at another server.

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

Standings are a separate per-group endpoint because they need every war in the group (28 for 8 clans), loaded from the game by the war tags `CWLGroups` keeps for all clans. The game serves a season's war tags only until the next CWL (checked 2026-10-18: October loaded, September and older came back empty), so older tables come back with `roundsPlayed: 0`. When wars are missing, the API reads them from the CWL archive the bot uses (`CwlArchiveService`, `GET https://archive.clashperk.com/clans/:tag/cwl/seasons/:YYYY-MM`, sent `API_KEY`). It uses GET because the archive's POST re-fetches the war tags from the game and caches whatever comes back, which is nothing once they've expired. The archive keys seasons by month, so wars are matched to the group by war tag; in a month with two CWLs a mismatch only leaves gaps. A failure only logs a warning and leaves the table partial. Checked 2026-10-18: April to October 2026 all complete for #2JQV9QL2Q.
