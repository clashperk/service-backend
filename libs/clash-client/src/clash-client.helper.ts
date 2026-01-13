import { APIClanWarAttack, APIPlayer, RawData } from 'clashofclans.js';
import { HOME_TROOPS, SUPER_TROOPS } from './constants';

export const RAW_TROOPS_FILTERED = RawData.RawUnits.filter((unit) => !unit.seasonal)
  .filter((unit) => unit.category !== 'equipment')
  .filter((unit) => !SUPER_TROOPS.includes(unit.name))
  .filter((unit) => HOME_TROOPS.includes(unit.name));

const getUnitLevelsMap = (data: APIPlayer) => {
  const map = new Map<string, number>();

  for (const u of data.troops) {
    map.set(`${u.name}:${u.village}:${'troop'}`, u.level);
  }

  for (const u of data.heroes) {
    map.set(`${u.name}:${u.village}:${'hero'}`, u.level);
  }

  for (const u of data.spells) {
    map.set(`${u.name}:${u.village}:${'spell'}`, u.level);
  }

  for (const u of data.heroEquipment) {
    map.set(`${u.name}:${u.village}:${'equipment'}`, u.level);
  }

  return map;
};

export function remainingHeroUpgrades(data: APIPlayer) {
  const unitLevels = getUnitLevelsMap(data);

  const rem = RAW_TROOPS_FILTERED.reduce(
    (record, unit) => {
      if (unit.category === 'hero' && unit.village === 'home') {
        const level = unitLevels.get(`${unit.name}:${unit.village}:${unit.category}`) ?? 0;
        record.levels += level;
        record.total += unit.levels[data.townHallLevel - 1];
      }
      return record;
    },
    { total: 0, levels: 0 },
  );

  if (rem.total === 0) return 0;
  return ((rem.levels * 100) / rem.total).toFixed(2);
}

export function remainingLabUpgrades(data: APIPlayer) {
  const unitLevels = getUnitLevelsMap(data);
  const rem = RAW_TROOPS_FILTERED.reduce(
    (record, unit) => {
      if (unit.category !== 'hero' && unit.village === 'home') {
        const level = unitLevels.get(`${unit.name}:${unit.village}:${unit.category}`) ?? 0;
        record.levels += level;
        record.total += unit.levels[data.townHallLevel - 1];
      }
      return record;
    },
    { total: 0, levels: 0 },
  );
  if (rem.total === 0) return 0;
  return ((rem.levels * 100) / rem.total).toFixed(2);
}

export function calculateRushedPercentage(data: APIPlayer) {
  const unitLevels = getUnitLevelsMap(data);
  const rem = RAW_TROOPS_FILTERED.reduce(
    (record, unit) => {
      if (unit.village === 'home') {
        const level = unitLevels.get(`${unit.name}:${unit.village}:${unit.category}`) ?? 0;
        // Check levels for previous TH (TH-2 index)
        const targetLevel = unit.levels[data.townHallLevel - 2];
        // If target level exists (might be undefined for low THs i.e. TH1), default to 0 to be safe
        const safeTargetLevel = targetLevel ?? 0;

        record.levels += Math.min(level, safeTargetLevel);
        record.total += safeTargetLevel;
      }
      return record;
    },
    { total: 0, levels: 0 },
  );
  if (rem.total === 0) return 0;
  return (100 - (rem.levels * 100) / rem.total).toFixed(2);
}

export function isFreshAttack(
  attacks: APIClanWarAttack[],
  { defenderTag, order }: { defenderTag: string; order: number },
) {
  const defenderDefenses = attacks.filter((atk) => atk.defenderTag === defenderTag);
  const isFresh =
    defenderDefenses.length === 0 ||
    order === Math.min(...defenderDefenses.map((def) => def.order));

  return isFresh;
}

export function getPreviousBestAttack(
  attacks: APIClanWarAttack[],
  atk: { defenderTag: string; attackerTag: string; order: number },
) {
  const { defenderTag, attackerTag, order } = atk;

  if (isFreshAttack(attacks, atk)) return null;

  return (
    attacks
      .filter(
        (atk) =>
          atk.defenderTag === defenderTag && atk.order < order && atk.attackerTag !== attackerTag,
      )
      .sort((a, b) => b.destructionPercentage ** b.stars - a.destructionPercentage ** a.stars)
      .at(0) ?? null
  );
}
