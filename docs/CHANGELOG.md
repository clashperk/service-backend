# Changelog

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
