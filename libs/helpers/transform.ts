import {
  ACHIEVEMENTS_ENUM,
  ACHIEVEMENTS_MAP_BY_NAME,
  SUPER_TROOP_SET,
  UNITS_MAP_BY_NAME,
} from '@app/constants';
import { APIPlayer } from 'clashofclans.js';
import { APIPlayerTransformed } from './types';

export function transformAPIPlayer(
  player: APIPlayer,
  params: { seasonId: string; monthId: string },
): APIPlayerTransformed {
  const achievements = player.achievements.reduce<Record<string, number>>((acc, curr) => {
    const key = ACHIEVEMENTS_MAP_BY_NAME[curr.name];
    if (key) acc[key] = curr.value;
    return acc;
  }, {});

  const units = [
    ...player.troops,
    ...player.heroes,
    ...player.spells,
    ...(player.heroEquipment ?? []),
  ].reduce<Record<string, number>>((acc, curr) => {
    const key = UNITS_MAP_BY_NAME[curr.name];
    if (key) acc[key] = curr.level;
    return acc;
  }, {});

  const superTroops = player.troops.reduce<Record<string, number>>((acc, curr) => {
    if (!SUPER_TROOP_SET.has(curr.name)) return acc;
    const key = UNITS_MAP_BY_NAME[curr.name];
    if (key) acc[key] = curr.superTroopIsActive ? 1 : 0;
    return acc;
  }, {});

  const heroes = player.heroes.reduce<
    Record<string, { level: number; equipment: Record<string, number> }>
  >((record, hero) => {
    const key = UNITS_MAP_BY_NAME[hero.name];
    if (!key) return record;

    record[key] = {
      level: hero.level,
      equipment: (hero.equipment ?? []).reduce<Record<string, number>>((acc, curr) => {
        const key = UNITS_MAP_BY_NAME[curr.name];
        if (key) acc[key] = curr.level;
        return acc;
      }, {}),
    };

    return record;
  }, {});

  return {
    name: player.name,
    tag: player.tag,
    townHallLevel: player.townHallLevel,
    townHallWeaponLevel: player.townHallWeaponLevel,
    expLevel: player.expLevel,
    trophies: player.trophies,
    bestTrophies: player.bestTrophies,
    warStars: player.warStars,
    attackWins: player.attackWins,
    defenseWins: player.defenseWins,
    builderHallLevel: player.builderHallLevel,
    builderBaseTrophies: player.builderBaseTrophies,
    bestBuilderBaseTrophies: player.bestBuilderBaseTrophies,
    donations: player.donations,
    donationsReceived: player.donationsReceived,
    clanCapitalContributions: player.clanCapitalContributions,
    role: player.role,
    warPreference: player.warPreference,
    clan: player.clan
      ? {
          tag: player.clan.tag,
          name: player.clan.name,
          donations: player.donations,
          donationsReceived: player.donationsReceived,
        }
      : null,
    leagueId: player.leagueTier?.id || 105000000,
    builderBaseLeagueId: player.builderBaseLeague?.id ?? 44000000,
    leagueGroupTag: player.currentLeagueGroupTag,
    leagueSeasonId: player.currentLeagueSeasonId,
    achievements,
    units,
    heroes,
    superTroops,
    initialClanGamesPoints: achievements[ACHIEVEMENTS_ENUM.CLAN_GAMES_POINTS] || 0,
    builderBattleWins: 0,
    labels: player.labels.map((label) => label.id),
    version: 4,
    ex: Date.now() + 1000 * 60 * 60 * 6,
    ...params,
  };
}
