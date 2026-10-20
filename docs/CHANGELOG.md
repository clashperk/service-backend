# Changelog

## 2026-10-20 (tickets)
- Ticket panels in `/ticket setup`'s format, for beta servers only (403 elsewhere): `GET /guilds/:guildId/tickets` (panels with open and total ticket counts, and saved replies); `POST`, `PATCH` and `DELETE /guilds/:guildId/tickets/panels/:panelId`; `POST`, `PATCH` and `DELETE .../types/:typeId` and `PUT .../types/order`; `PUT /guilds/:guildId/tickets/saved-replies`
- Limits match the bot (25 types, 5 questions, 10 roles per list, 10 extra buttons, 25 saved replies), plus stricter checks: whole numbers above zero, real links, and question labels of at most 45 characters, which is what Discord shows
- `GET /guilds/:guildId/categories` lists category channels for where tickets open and sleep

## 2026-10-20 (beta servers)
- Beta servers move into the `BetaGuilds` collection. Admins manage them with `GET`, `POST` (`{ guildIds, note? }`, existing ones are kept as they are) and `DELETE /admin/beta-guilds/:guildId`
- `GET /beta-guilds/ids` (API key) lists the IDs for the bot's command-registration workflow
- `GET /guilds/:guildId/beta` says whether a server is in beta, for the dashboard's beta pages

## 2026-10-20 (clan log limit)
- Saving a clan's first log is refused (403) once the server has logs for `Settings.clanLimit` clans (2 when unset; Patreon raises it), as `/setup clan-logs` does. Any log, on or off, counts its clan; logs of removed clans don't. Clans that already have logs can get more
- Add `GET /guilds/:guildId/clan-logs/limit` with the limit, the clans that count and whether the server is a patron

## 2026-10-20 (manager roles)
- Add `GET` and `PATCH /guilds/:guildId/managers` for the bot manager, roster manager, flags manager and links manager roles, as `/config` stores them (lists of role IDs; older single IDs read as a list; an empty list removes the role)
- Add `POST /auth/managed-guilds` (API key): the servers, out of those given, where a user holds the bot manager role. The dashboard lets them in like Manage Server
- `POST /auth/handoff` only puts the server in the token when the user owns it, has Administrator or Manage Server, or holds the bot manager role; otherwise the dashboard opens without a server. The bot's links reach roster and links managers too, who shouldn't get the whole server

## 2026-10-20 (server logs)
- Add `GET /guilds/:guildId/server-logs` with the flag alert log, roster changelog, maintenance channel and welcome message, each null when not set up
- Add `PUT` and `DELETE` for `/guilds/:guildId/server-logs/{flag-alert,roster-changelog,maintenance,welcome}`, in `/setup server-logs`'s format. Flag alerts go in `FlagAlertLogs` and set `hasFlagAlertLog`; turning the welcome message off keeps its text. Without a known webhook the record stores none and the bot creates one when it first posts

## 2026-10-20 (clan settings)
- Add `PATCH /guilds/:guildId/clans/:clanTag` (`{ alias?, nickname?, channels? }`), as `/alias create` and `/setup clan` set them: alias up to 15 characters with no spaces or leading #, unique in the server ignoring case; short name (`nickname`) up to 15; clan channels must be channels or threads in the server and can belong to one clan. `null` or an empty list clears a field
- `GET /guilds/:guildId/clans` returns each clan's `alias`, `nickname` and `channels`

## 2026-10-20 (roster writes)
- Rosters can be created, edited (including opening and closing sign-ups), cloned and deleted: `POST /rosters/:guildId/create`, `PATCH`, `DELETE /rosters/:guildId/:rosterId`, `POST .../clone`. Records use `/roster create`'s format, start from the server's last-used settings and save them back, and seed the Confirmed and Substitute groups the first time
- Add `POST /rosters/:guildId/:rosterId/members/check`: runs the sign-up checks on up to 100 tags without saving and says why each player can or can't join
- `PUT /rosters/:guildId/:rosterId/members` adds the players who pass, with an optional group; `POST .../members/refresh` re-reads members from the game and their links
- Add `POST /rosters/:guildId/groups`, `PATCH` and `DELETE /rosters/:guildId/groups/:groupId`
- Fix: moving players to another roster now runs every sign-up check (one roster per player, accounts per member) and writes the bot's member record; an unset roster size is 65, as in the bot; rosters with no clan no longer fail; groups list in their order

## 2026-10-20 (flags)
- Add `GET /guilds/:guildId/flags?flagType=` (active bans and strikes, newest first, with the active total and the server's limit), `POST /guilds/:guildId/flags` (`{ flagType, playerTags, reason, expiresInDays?, flagImpact? }`, one flag per player found) and `DELETE /guilds/:guildId/flags/:flagId`
- Flags use `/flag create`'s record and rules: 1,000 active flags unless the server is a supporter, reasons up to 256 characters, expiry of 1 to 36,500 days or never, strike points 1 to 100. Only active flags can be deleted

## 2026-10-20 (nicknames)
- `GET` and `PATCH /guilds/:guildId/auto-roles` add nicknames: family and non-family formats, automatic nicknames, which account a nickname uses, and short labels for `{ROLE}`. Formats follow `/nickname config`: each needs a name placeholder, and the non-family one can't use clan placeholders; formats are up to 100 characters (nicknames are cut to 32)
- Only role fields need a clan in the server; options and nicknames save without one, as in the bot

## 2026-10-20 (auto-roles)
- Add `GET` and `PATCH /guilds/:guildId/auto-roles`: Town Hall, Builder Hall, league, builder league and trophy roles; family, exclusive family, family leaders, guest, verified and linked roles; the end-of-season push role and clans; and the options (non-family accounts, verified-only clan roles, auto update, force refresh, members with no links, role delays and delay exclusions). Only the fields sent are saved, under the keys `/autorole` uses; an empty map or `null` turns it off
- Add `PUT /guilds/:guildId/auto-roles/clans/:clanTag`: a clan's Leader, Co-Leader, Elder, Member and Everyone roles and its in-war role, which can't be shared with another clan
- Roles must be in the server, not @everyone or managed by a bot or integration, and not above ClashPerk's highest role, as the bot checks

## 2026-10-20 (manage clans)
- Add `POST /guilds/:guildId/clans` (`{ tag, categoryId? }`) and `DELETE /guilds/:guildId/clans/:clanTag`. Adding uses the bot's record and its verification rule: past 5, 20 or 100 clans (by server size), or for a clan already in more than 10 other servers, it needs `CP` plus the server ID's last two digits in the clan description or a verified Leader or Co-Leader account of the caller; supporters skip it. Removing also deletes the clan's logs, takes it off reminders (deleting reminders left with no clans) and clears their schedules
- Add `POST /guilds/:guildId/categories`, `PATCH` and `DELETE /guilds/:guildId/categories/:categoryId` (names 1 to 36 characters, unique per server). Deleting a category moves its clans to Uncategorized
- Each returns the server's clans and categories, as `GET /guilds/:guildId/clans` does

## 2026-10-20 (threads)
- `GET /guilds/:guildId/channels` adds active threads and forum or media posts, each listed under its channel. A forum or media channel with posts is listed only as their heading (`selectable: false`). `position` is gone; the list comes in Discord's order
- Reminders and clan logs accept a thread or forum post as the channel. The webhook, from Discord's sign-in or reused, must belong to the thread's channel, which is how the bot posts there
- Saved archived threads keep their names in the reminder and clan log lists

## 2026-10-20 (clan logs)
- Add `GET /guilds/:guildId/clans/:clanTag/logs`, `PUT` and `DELETE /guilds/:guildId/clans/:clanTag/logs/:logType` for the log types `/setup clan-logs` offers. Records use the bot's format (clan record, deep link, 30-minute backfill); a log kept in the same channel keeps its webhook and self-updating message, and a moved one starts fresh. Channel and ping role must be in the server, and the clan must be added to it
- Channel, role and webhook lookups are shared by reminders and clan logs

## 2026-10-20 (reminder writes)
- Add `GET /guilds/:guildId/channels` (text and announcement channels, with `hasWebhook` when ClashPerk already posts there) and `GET /guilds/:guildId/roles` (no @everyone or bot roles)
- Add `POST`, `PUT /:reminderId` and `DELETE /:reminderId` under `/guilds/:guildId/reminders/clan-wars`, `/capital-raids` and `/clan-games`. Records use the bot's format and limits (15 minutes up to 48 hours, 3 days or 6 days, in 15-minute steps; 5 per clan or 25 unless the server is a supporter), the channel and clans must belong to the server, and saving schedules the reminder for a war, raid weekend or Clan Games already running
- A reminder can carry a webhook from Discord's `webhook.incoming` sign-in, checked against the server and channel; without one, a webhook ClashPerk already has in that channel is reused, else the bot creates one when the reminder first fires

## 2026-10-19 (build fix)
- Fix the 2.0.39 build: the standings endpoint passed the whole CWL group to the archive lookup, which now takes the season

## 2026-10-18 (CWL seasons)
- Add `GET /wars/:clanTag/clan-war-leagues/seasons?limit=` (1–12, default 3): the clan's CWL seasons from its stored wars, newest first. Each has the clan's war league and group size (from the stored group), its rounds in order with result and score, and each member's wars, attacks, stars, 3-stars, total destruction and missed attacks. Each season also has its stored `groupId` and the game's `groupSeason`
- Add `GET /wars/:clanTag/clan-war-leagues/groups/:groupId/standings`: the group's table from all its wars, loaded live by war tag (stars plus 10 per win, total destruction, wins, starting league), with `roundsPlayed`, `totalRounds` and `complete` (false when some wars no longer load). Wars the game has dropped are filled from the CWL archive the bot uses

## 2026-10-18 (war history)
- Add `GET /wars/:clanTag?limit=&before=` (limit 1–50, default 20): the clan's stored wars newest first, from its own side, with type, state, result and each side's stars, destruction and attacks but no member lists. `next` is the last war's start time; pass it as `before` for the next page

## 2026-10-18 (activity)
- Add `POST /clans/activity` with `{ clanTags (1–10), days (1–30, default 7), limit (1–100, default 50), types (optional) }`: the clans' Town Hall upgrades, joins and leaves, clan and Capital Hall level-ups, and war and capital league changes, newest first, with player, clan and league names filled in

## 2026-10-18 (Home)
- Add `GET /players/:playerTag/seasons?limit=` (1–12, default 2): season stats from `PlayerSeasons`, newest first — trophies, attack and defense wins, donations given and received (summed over clans), and the season's gains in war stars, CWL stars, capital gold, Clan Games points and loot
- Add `GET /clans/:clanTag/clan-games?season=`: each member's points and finish time for a Clan Games (`YYYY-MM`, default the latest), the 22nd–28th window, the 10,000-point member cap and the clan total counted to that cap
- Add `GET /events/upcoming`: the running or next season, raid weekend, Clan Games and CWL, each `active` or `upcoming`

## 2026-10-18
- Add `GET /players/:playerTag` and `GET /clans/:clanTag`: live profiles from the Clash of Clans API (cached 2 min), typed with DTOs that mirror the raw `clashofclans.js` structures
- Add `GET /wars/:clanTag/current`: `{ isWarLogPublic, war }`, the regular war or, during CWL, the round in war (else in preparation, else the last ended one); `war` is null when the clan is in neither
- `POST /links` refuses (403) linking a tag to another Discord user unless the caller is an admin or a verified Leader/Co-Leader of the player's clan
- `PUT /players/:tag` is now admin-only as documented; `RolesGuard` runs on the players controller
- `GET /wars/:clanTag/:warId` returns 404 when the clan was not in that war
- Removing roster members only returns the roster if it belongs to the request's guild

## 2026-10-11
- Add `GET /clans/:clanTag/capital-raids?limit=` (1–60, default 5), ported from the v1 API; returns `{ items }` of raid seasons, newest first
