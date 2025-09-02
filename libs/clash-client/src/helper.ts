import { APIClanWarAttack } from 'clashofclans.js';

export function getPreviousBestAttack(
  attacks: APIClanWarAttack[],
  { defenderTag, attackerTag, order }: { defenderTag: string; attackerTag: string; order: number },
) {
  const defenderDefenses = attacks.filter((atk) => atk.defenderTag === defenderTag);
  const isFresh =
    defenderDefenses.length === 0 ||
    order === Math.min(...defenderDefenses.map((def) => def.order));

  if (isFresh) return null;

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
