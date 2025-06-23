import { APIClanWarAttack, APIWarClan } from 'clashofclans.js';

export function getPreviousBestAttack(
  attacks: APIClanWarAttack[],
  opponent: APIWarClan,
  atk: APIClanWarAttack,
) {
  const defender = opponent.members.find((m) => m.tag === atk.defenderTag);
  const defenderDefenses = attacks.filter((atk) => atk.defenderTag === defender?.tag);
  const isFresh =
    defenderDefenses.length === 0 ||
    atk.order === Math.min(...defenderDefenses.map((d) => d.order));
  const previousBestAttack = isFresh
    ? null
    : ([...attacks]
        .filter(
          (_atk) =>
            _atk.defenderTag === defender?.tag &&
            _atk.order < atk.order &&
            _atk.attackerTag !== atk.attackerTag,
        )
        .sort((a, b) => b.destructionPercentage ** b.stars - a.destructionPercentage ** a.stars)
        .at(0) ?? null);
  return isFresh ? null : previousBestAttack;
}
