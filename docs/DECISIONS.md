# Decisions

## 2026-10-22 — The API key travels only in a header or cookie
Decided by: Suvajit. The api stops reading `?apiKey=`, because URLs land in our logs, Sentry traces and proxy logs, and the key acts as ADMIN for any user. No caller in this repo used it; an outside caller still sending it now gets 401 and must switch to `x-api-key`. The worker's guard still reads the query and is out of this change.

## 2026-10-22 — Two security review findings are accepted for now
Decided by: Suvajit. Tokens from `POST /auth/generate-passkey` keep no expiry, so a revoked or downgraded portal user keeps a token issued that way until `JWT_SECRET` rotates. The bot can still be set to grant roles with moderator permissions (auto-roles check only the bot's own rank; ticket add-roles only that the role is in the server; roster and roster-group roles not at all), so a user with only the bot's manager role can hand themselves such a role.

## Clash API requests are capped per process
Each tracker fork bursts to about 200 requests in flight (five services, each running `Promise.all` over whole clans). Measured in a container over five runs, per-request latency grows with in-flight depth in one process: about 40 ms at 24, 55 ms at 48, 95 ms at 96 and 220–300 ms at 200. `libs/clash-client/src/inflight-limiter.ts` bounds the depth, so bursts queue as cheap promises instead of at the server, cutting latency 2–4×. The semaphore is process-wide because each tracker service builds its own `ClashClient`; a per-client cap would allow six times the intended depth. The default, `CLASH_API_MAX_INFLIGHT=96`, is the conservative choice: its worst run still sustained 248 requests a second, about twice what a fork uses (100–120), while the median fetch drops from about 224 ms to 95 ms. 48 roughly halves latency again, but its worst run was 126 requests a second, too close to demand for a default. `0` turns the cap off without a code change.

## 2026-10-22 — Ranked weeks come live from the game
Decided by: Claude, pending Suvajit's review. `GET /players/:playerTag/ranked` reads the player, their league group (`/leaguegroup/{tag}/{seasonId}?playerTag=`, which carries their own attack and defense logs) and their league history from the Clash API, like the bot's ranked view, rather than our `battle_logs`, which only cover tracked players. Promotion and demotion zone sizes use the bot's `LeaguePromotionsMap` percentages, rounded up. League tier names and icons are fetched once per process.

## 2026-10-22 — Legend seasons total trophies, not attacks
Decided by: Claude, pending Suvajit's review. The worker logs a trophy change each time it sees one, so several attacks between two checks land as one `attack` entry (+269 for what was 7 or 8 attacks), and `attackLogs`/`defenseLogs` count those entries, not attacks. `GET /legends/:playerTag/seasons` therefore reports only trophies gained from attacks and lost to defenses, and no attack or defense counts.

## 2026-10-22 — Joins and leaves get their own clan-ordered table
Decided by: Suvajit (materialized view), details by Claude. `player_activities` (1.26 billion rows) is ordered by player tag, so `WHERE clanTag = …` read every row in the date range: about 64 million rows and 5–10 seconds for 30 days. `clan_join_leave_logs` is ordered by `(clanTag, createdAt)` and filled by `clan_join_leave_logs_mv` on every insert into `player_activities`, so the worker is unchanged. It keeps 90 days (TTL), three times the activity endpoint's 30-day maximum. The migration backfills rows older than the view's creation in 30-day slices; it is a `ReplacingMergeTree` keyed on every column, so rows written in the seconds around the view's creation that land twice are merged away. `pnpm migrate:clickhouse` waits up to 10 minutes per statement for the backfill.

## 2026-10-22 — League season ids no longer depend on an env var
The 2026-10-21 migration renamed every stored 28-day id to its start date and its backups were dropped, so the `SEASON_SPLIT` flag-off path could only write legacy `YYYY-MM` ids that collide with the renamed history. `Season.leagueId` is always the start date. `toLeagueId` still maps a legacy `YYYY-MM` id to its start date, because older clients may send one. The `season-split` script went with the flag: with no backups and no legacy ids left, it has nothing to do.

## 2026-10-20 — Roster writes follow the bot; roles wait for its refresh
The bot reads rosters fresh, so the API writes them directly in `/roster`'s format and checks. Sign-up checks live in one place (`evaluate`), used by the check endpoint, adding and moving; it counts players earlier in the same request toward the size and accounts-per-member limits, which the bot's bulk import doesn't. The bot gives and removes roster and group roles and posts change logs through its own Discord client, so players added, moved or removed here get their roles when the bot next reconciles them (its Refresh button or the next sign-up). Times are ISO strings; the bot's timezone lookup is for typed times and isn't needed. Deleting a group leaves members pointing at it, as the bot does.

## 2026-10-20 — Flags are written as `/flag create` writes them, minus the DM
The bot reads flags from `Flags` whenever a flagged player joins, so no bot change is needed. The record keeps the bot's author fields (Discord ID, username, display name, discriminator), fetched from Discord for the caller. Reasons are stored with markdown escaped, as the bot does with `escapeMarkdown`, and returned unescaped; the API escapes only `\ ` * _ ~ | >`, a subset of discord.js. `/flag create`'s option to DM the flagged player is left out: it messages members, so it waits until the bot calls the API. Deleting removes one flag by ID; the bot's delete-all-for-a-player and delete-a-clan's-flags options aren't in the API yet.

## 2026-10-20 — Auto-roles are written where the bot reads them, with no bot change
Server-wide roles and options go in `Settings` under `/autorole`'s keys, each map written whole with `$set`, and anything turned off is `$unset` as `/autorole disable` does. The bot reloads `Settings` through its change stream and reads clan roles from `ClanStores` on every update, so neither needs a bot change. As with the bot, saving doesn't refresh members' roles; they update on the bot's next check. Unlike the bot, the API can remove single entries (a map is replaced, not merged) and can clear trophy roles, which no bot command does. The bot's role-position check uses its gateway cache; the API asks Discord for the bot's member roles instead. The bot's after-save `updateClanLinks` is left out: it only refreshes links and doesn't affect roles.

## 2026-10-20 — Adding a clan follows `/setup clan`, minus the bot-only parts
The record matches `storage.register`: `verified`, `active`, `paused: false`, `patron`, and a `uniqueId` shared with other servers that have the clan (else the highest plus one), which the tracker keys on. The bot notices the new record through a `ClanStores` watcher, so the API doesn't call it. Verification matches `enforceSecurity`, using the caller's own links (`x-user-id` when the bot calls); the bot-owner bypass stays in the bot. A clan's channel links, color and alias aren't set here yet. Categories differ in two ways: the API doesn't create the bot's default categories when a server has none, and deleting one moves its clans to Uncategorized instead of leaving them pointing at a deleted category.

## 2026-10-20 — Threads are picked like channels and post through their parent's webhook
The bot already stores a thread's ID as the record's channel and posts through the parent channel's webhook with `thread_id` (`client.util.hasPermissions`), and threads can't own webhooks, so the API saves threads the same way and checks or reuses webhooks by the parent. Only active threads are offered: the bot looks channels up in its cache, which holds archived threads only after they come back, and Discord's guild endpoint lists active threads in one call. Archived threads on saved records are named with one lookup each, since names are only shown. Forums and media channels are headings, not targets, because the bot can't post in them directly.

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

## 2026-10-20 — Only the bot manager role opens the dashboard
Decided by: Suvajit. The bot treats `managerRole` like Manage Server, so its holders get the same dashboard access; the roster, flags and links manager roles stay Discord-only until the API can scope a session to some pages. `POST /auth/managed-guilds` looks members up with the main bot's token and only in servers that set the role, so sign-in costs one Discord call per such server. Handoffs from the bot's links follow the same rule: `createHandoffToken` checks owner, Administrator or Manage Server (from the member's roles and @everyone) or the bot manager role, using the custom bot's token when the link came from one, and leaves the server out otherwise or when Discord can't be reached.

## 2026-10-20 — The API applies the bot's clan log limit
Decided by: Suvajit. `/setup clan-logs` only allows logs for `clanLimit` clans (2 free; the bot's Patreon sync writes a higher number), and the dashboard could bypass it. `GuildLogsService.save` now checks it before a clan's first log, with the bot's messages. The bot lets its owners past the limit; the API doesn't know them, so it doesn't.

## 2026-10-20 — Beta servers live in the database
Decided by: Suvajit. `BetaGuilds` replaces the bot's `BETA_TESTERS` GitHub variable as the one list of beta servers. Admins edit it in the dashboard; the bot's command-registration workflow reads `GET /beta-guilds/ids` with the API key. Beta is one flag per server, not per feature: beta servers get every beta feature, Tickets first.

## 2026-10-20 — Tickets from the dashboard
Decided by: Suvajit. The API writes `TicketPanels` and `TicketSettings` as `/ticket setup` does; the bot reads them fresh on every click, so it needs no reload. Posting stays with `/ticket post`, because the bot doesn't record where panels are posted and buttons-mode IDs live in its Redis. Type IDs are kept on every edit since posted buttons and opened tickets point at them. Fields the bot never uses (closed category, hero requirements, max accounts) are left out.

## 2026-10-20 — The `user` role means a dashboard session
Decided by: Suvajit. PortalUsers sign in with `/auth/login` and get the API's own tokens (version `v2`); the dashboard signs its users' tokens with version `1`. `JwtStrategy` marks non-dashboard tokens as `portal`, and `RolesGuard` refuses them on routes whose only role is `user`, before the admin bypass, so a PortalUser can't reach server settings even if given `user` or `admin`. Routes meant for API users name their role (`fetch:*`, `manage:*`) alongside `user`. Checked on 2026-10-20: no PortalUser has `user`; two have `admin`.

## 2026-10-20 — Dashboard sessions re-check server access hourly
Decided by: Suvajit. The dashboard checked access only when switching servers, so someone who lost Manage Server or the bot manager role kept the server while signed in. It now asks `POST /auth/guild-access` each time it renews the API token (hourly) and drops the server on `false`. A failed check keeps the server until the next renewal, so a Discord or API outage doesn't sign everyone out of their server.
