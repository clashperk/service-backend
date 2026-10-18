# Changelog

## 2026-10-18
- Add `GET /players/:playerTag` and `GET /clans/:clanTag`: live profiles from the Clash of Clans API (cached 2 min), typed with DTOs that mirror the raw `clashofclans.js` structures
- Add `GET /wars/:clanTag/current`: `{ isWarLogPublic, war }`, the regular war or, during CWL, the round in war (else in preparation, else the last ended one); `war` is null when the clan is in neither
- `POST /links` refuses (403) linking a tag to another Discord user unless the caller is an admin or a verified Leader/Co-Leader of the player's clan
- `PUT /players/:tag` is now admin-only as documented; `RolesGuard` runs on the players controller
- `GET /wars/:clanTag/:warId` returns 404 when the clan was not in that war
- Removing roster members only returns the roster if it belongs to the request's guild

## 2026-10-11
- Add `GET /clans/:clanTag/capital-raids?limit=` (1–60, default 5), ported from the v1 API; returns `{ items }` of raid seasons, newest first
