import { RAW_DATA } from 'clashofclans.js';

export enum WarType {
  REGULAR = 1,
  FRIENDLY,
  CWL,
}

/** @deprecated */
export const extraAchievements = {
  'Union Buster': 'builderHutsDestroyed',
  'Wall Buster': 'wallsDestroyed',
  'Nice and Tidy': 'obstaclesRemoved',
  'Superb Work': 'superTroopsBoosted',
  'Monolith Masher': 'monolithDestroyed',
  'Get those Goblins!': 'goblinStars',
  'Anti-Artillery': 'artilleriesDestroyed',
  'Shattered and Scattered': 'scattershotsDestroyed',
  'Counterspell': 'spellTowersDestroyed',
  'X-Bow Exterminator': 'xbowsDestroyed',
  'Mortar Mauler': 'mortarsDestroyed',
  'Firefighter': 'infernoTowersDestroyed',
} as const;

/** @deprecated */
export const extraAchievementsSet: Set<string> = new Set(Object.keys(extraAchievements));

/** @deprecated */
export const achievements = {
  'Most Valuable Clanmate': 'capitalGoldContributions',
  'Aggressive Capitalism': 'clanCapitalRaids',
  'Games Champion': 'clanGamesPoints',

  'Heroic Heist': 'darkElixirLoots',
  'Elixir Escapade': 'elixirLoots',
  'Gold Grab': 'goldLoots',

  'Siege Sharer': 'siegeMachinesDonations',
  'Friend in Need': 'troopsDonations',
  'Sharing is caring': 'spellsDonations',

  'War Hero': 'clanWarStars',
  'War League Legend': 'clanWarLeagueStars',

  'Well Seasoned': 'seasonChallengePoints',

  ...extraAchievements,

  'Combined achievements': 'combinedAchievements',
} as const;

/** @deprecated */
export const troops = {
  'Barbarian': 'barbarian',
  'Archer': 'archer',
  'Goblin': 'goblin',
  'Giant': 'giant',
  'Wall Breaker': 'wall_breaker',
  'Balloon': 'balloon',
  'Wizard': 'wizard',
  'Healer': 'healer',
  'Dragon': 'dragon',
  'P.E.K.K.A': 'pekka',
  'Minion': 'minion',
  'Hog Rider': 'hog_rider',
  'Valkyrie': 'valkyrie',
  'Golem': 'golem',
  'Witch': 'witch',
  'Lava Hound': 'lava_hound',
  'Bowler': 'bowler',
  'Baby Dragon': 'baby_dragon',
  'Miner': 'miner',
  'Raged Barbarian': 'raged_barbarian',
  'Sneaky Archer': 'sneaky_archer',
  'Beta Minion': 'beta_minion',
  'Boxer Giant': 'boxer_giant',
  'Bomber': 'bomber',
  // Replaced with Power P.E.K.K.A
  'Super P.E.K.K.A': 'super_pekka',
  'Power P.E.K.K.A': 'power_pekka',
  'Cannon Cart': 'cannon_cart',
  'Drop Ship': 'drop_ship',
  'Night Witch': 'night_witch',
  'Wall Wrecker': 'wall_wrecker',
  'Battle Blimp': 'battle_blimp',
  'Yeti': 'yeti',
  'Ice Golem': 'ice_golem',
  'Electro Dragon': 'electro_dragon',
  'Stone Slammer': 'stone_slammer',
  'Dragon Rider': 'dragon_rider',
  'Hog Glider': 'hog_glider',
  'Siege Barracks': 'siege_barracks',
  'Headhunter': 'headhunter',
  'Apprentice Warden': 'apprentice_warden',
  'Log Launcher': 'log_launcher',
  'Flame Flinger': 'flame_flinger',
  'Battle Drill': 'battle_drill',
  'Electro Titan': 'electro_titan',
} as const;

/** @deprecated */
export const super_troops = {
  'Super Barbarian': 'super_barbarian',
  'Super Archer': 'super_archer',
  'Super Wall Breaker': 'super_wall_breaker',
  'Super Giant': 'super_giant',
  'Super Miner': 'super_miner',
  'Super Valkyrie': 'super_valkyrie',
  'Super Witch': 'super_witch',
  'Sneaky Goblin': 'sneaky_goblin',
  'Inferno Dragon': 'inferno_dragon',
  'Ice Hound': 'ice_hound',
  'Rocket Balloon': 'rocket_balloon',
  'Super Bowler': 'super_bowler',
  'Super Dragon': 'super_dragon',
  'Super Wizard': 'super_wizard',
  'Super Minion': 'super_minion',
  'Super Hog Rider': 'super_hog_rider',
} as const;

/** @deprecated */
export const pets = {
  'L.A.S.S.I': 'lassi',
  'Mighty Yak': 'mighty_yak',
  'Electro Owl': 'electro_owl',
  'Unicorn': 'unicorn',
  'Phoenix': 'phoenix',
  'Poison Lizard': 'poison_lizard',
  'Diggy': 'diggy',
  'Frosty': 'frosty',
} as const;

/** @deprecated */
export const heroes = {
  'Barbarian King': 'barbarian_king',
  'Archer Queen': 'archer_queen',
  'Grand Warden': 'grand_warden',
  'Battle Machine': 'battle_machine',
  'Royal Champion': 'royal_champion',
} as const;

/** @deprecated */
export const spells = {
  'Lightning Spell': 'lightning_spell',
  'Healing Spell': 'healing_spell',
  'Rage Spell': 'rage_spell',
  'Jump Spell': 'jump_spell',
  'Freeze Spell': 'freeze_spell',
  'Poison Spell': 'poison_spell',
  'Earthquake Spell': 'earthquake_spell',
  'Haste Spell': 'haste_spell',
  'Clone Spell': 'clone_spell',
  'Skeleton Spell': 'skeleton_spell',
  'Bat Spell': 'bat_spell',
  'Invisibility Spell': 'invisibility_spell',
  'Recall Spell': 'recall_spell',
} as const;

/** @deprecated */
export const units = {
  ...troops,
  ...super_troops,
  ...heroes,
  ...pets,
  ...spells,
} as const;

/** @deprecated */
export const unitsMap = Object.entries(units).reduce<Record<string, string>>(
  (acc, [key, value]) => {
    acc[value] = key;
    return acc;
  },
  {},
);

/** { "name": "id" } */
export const UNITS_MAP_BY_NAME: Record<string, number> = {
  'Barbarian': 1,
  'Archer': 2,
  'Goblin': 3,
  'Giant': 4,
  'Wall Breaker': 5,
  'Balloon': 6,
  'Wizard': 7,
  'Healer': 8,
  'Dragon': 9,
  'P.E.K.K.A': 10,
  'Minion': 11,
  'Hog Rider': 12,
  'Valkyrie': 13,
  'Golem': 14,
  'Witch': 15,
  'Lava Hound': 16,
  'Bowler': 17,
  'Baby Dragon': 32,
  'Miner': 19,
  'Super Barbarian': 20,
  'Super Archer': 21,
  'Super Wall Breaker': 22,
  'Super Giant': 23,
  'Raged Barbarian': 24,
  'Sneaky Archer': 25,
  'Beta Minion': 26,
  'Boxer Giant': 27,
  'Bomber': 28,
  'Power P.E.K.K.A': 29,
  'Cannon Cart': 30,
  'Drop Ship': 31,
  'Night Witch': 33,
  'Wall Wrecker': 34,
  'Battle Blimp': 35,
  'Yeti': 36,
  'Sneaky Goblin': 37,
  'Super Miner': 38,
  'Rocket Balloon': 39,
  'Ice Golem': 40,
  'Electro Dragon': 41,
  'Stone Slammer': 42,
  'Inferno Dragon': 43,
  'Super Valkyrie': 44,
  'Dragon Rider': 45,
  'Super Witch': 46,
  'Hog Glider': 47,
  'Siege Barracks': 48,
  'Ice Hound': 49,
  'Super Bowler': 50,
  'Super Dragon': 51,
  'Headhunter': 52,
  'Super Wizard': 53,
  'Super Minion': 54,
  'Log Launcher': 55,
  'Flame Flinger': 56,
  'Battle Drill': 57,
  'Electro Titan': 58,
  'Apprentice Warden': 59,
  'Super Hog Rider': 60,
  'Electrofire Wizard': 61,
  'Root Rider': 62,
  'Druid': 63,
  'Lightning Spell': 64,
  'Healing Spell': 65,
  'Rage Spell': 66,
  'Jump Spell': 67,
  'Freeze Spell': 68,
  'Poison Spell': 69,
  'Earthquake Spell': 70,
  'Haste Spell': 71,
  'Clone Spell': 72,
  'Skeleton Spell': 73,
  'Bat Spell': 74,
  'Invisibility Spell': 75,
  'Recall Spell': 76,
  'Overgrowth Spell': 77,
  'Barbarian King': 78,
  'Archer Queen': 79,
  'Grand Warden': 80,
  'Battle Machine': 81,
  'Royal Champion': 82,
  'Battle Copter': 83,
  'L.A.S.S.I': 84,
  'Mighty Yak': 85,
  'Electro Owl': 86,
  'Unicorn': 87,
  'Phoenix': 88,
  'Poison Lizard': 89,
  'Diggy': 90,
  'Frosty': 91,
  'Spirit Fox': 92,
  'Angry Jelly': 93,
  'Barbarian Puppet': 94,
  'Rage Vial': 95,
  'Archer Puppet': 96,
  'Invisibility Vial': 97,
  'Eternal Tome': 98,
  'Life Gem': 99,
  'Seeking Shield': 100,
  'Royal Gem': 101,
  'Earthquake Boots': 102,
  'Hog Rider Puppet': 103,
  'Giant Gauntlet': 104,
  'Vampstache': 105,
  'Haste Vial': 106,
  'Rocket Spear': 107,
  'Spiky Ball': 108,
  'Frozen Arrow': 109,
  'Giant Arrow': 110,
  'Heroic Torch': 111,
  'Healer Puppet': 112,
  'Fireball': 113,
  'Rage Gem': 114,
  'Healing Tome': 115,
  'Magic Mirror': 116,
  'Electro Boots': 117,
  'Thrower': 118,
  'Troop Launcher': 119,
  'Super Yeti': 120,
  'Furnace': 121,
  'Revive Spell': 122,
  'Minion Prince': 123,
  'Sneezy': 124,
  'Snake Bracelet': 125,
  'Dark Crown': 126,
  'Lavaloon Puppet': 127,
  'Henchmen Puppet': 128,
  'Dark Orb': 129,
  'Noble Iron': 130,
  'Ice Block Spell': 131,
  'Metal Pants': 132,
  'Action Figure': 133,
  'Meteor Staff': 134,
  'Meteor Golem': 135,
  'Totem Spell': 136,
};

/** { "id": "name" } */
export const UNITS_MAP_BY_ID = Object.entries(UNITS_MAP_BY_NAME).reduce<Record<string, string>>(
  (record, [name, id]) => {
    record[id] = name;
    return record;
  },
  {},
);

/** { "name": "id" } */
export const ACHIEVEMENTS_MAP_BY_NAME: Record<string, number> = {
  'Bigger Coffers': 1,
  'Get those Goblins!': 2,
  'Bigger & Better': 3,
  'Nice and Tidy': 4,
  'Discover New Troops': 5,
  'Gold Grab': 6,
  'Elixir Escapade': 7,
  'Sweet Victory!': 8,
  'Empire Builder': 9,
  'Wall Buster': 10,
  'Humiliator': 11,
  'Union Buster': 12,
  'Conqueror': 13,
  'Unbreakable': 14,
  'Friend in Need': 15,
  'Mortar Mauler': 16,
  'Heroic Heist': 17,
  'League All-Star': 18,
  'X-Bow Exterminator': 19,
  'Firefighter': 20,
  'War Hero': 21,
  'Clan War Wealth': 22,
  'Anti-Artillery': 23,
  'Sharing is caring': 24,
  'Keep Your Account Safe!': 35,
  'Master Engineering': 26,
  'Next Generation Model': 27,
  'Un-Build It': 28,
  'Champion Builder': 29,
  'High Gear': 30,
  'Hidden Treasures': 31,
  'Games Champion': 32,
  'Dragon Slayer': 33,
  'War League Legend': 34,
  'Well Seasoned': 36,
  'Shattered and Scattered': 37,
  'Not So Easy This Time': 38,
  'Bust This!': 39,
  'Superb Work': 40,
  'Siege Sharer': 41,
  'Aggressive Capitalism': 42,
  'Most Valuable Clanmate': 43,
  'Counterspell': 44,
  'Monolith Masher': 45,
  'Ungrateful Child': 46,
  'Supercharger': 47,
  'Multi-Archer Tower Terminator': 48,
  'Ricochet Cannon Crusher': 49,
  'Firespitter Finisher': 50,
  'Multi-Gear Tower Trampler': 51,
};

/** { "id": "name" } */
export const ACHIEVEMENTS_MAP_BY_ID = Object.entries(ACHIEVEMENTS_MAP_BY_NAME).reduce<
  Record<string, string>
>((record, [name, id]) => {
  record[id] = name;
  return record;
}, {});

interface RawUnit {
  id: number;
  name: string;
  village: string;
  category: string;
  subCategory: string;
  maxLevel: number;
}

/** { "name": "RawUnit" } */
export const RAW_UNITS_MAP = RAW_DATA.RAW_UNITS.reduce<Record<string, RawUnit>>((record, unit) => {
  record[unit.name] = {
    id: unit.id,
    name: unit.name,
    village: unit.village,
    category: unit.category,
    subCategory: unit.subCategory,
    maxLevel: unit.levels[unit.levels.length - 1],
  };
  return record;
}, {});

export enum ACHIEVEMENTS_ENUM {
  SEASON_CHALLENGE_POINTS = 36,
  CAPITAL_CONTRIBUTION = 43,
  CLAN_CAPITAL_RAIDS = 42,
  CLAN_GAMES_POINTS = 32,
  DARK_ELIXIR_LOOTS = 17,
  GOLD_LOOTS = 6,
  ELIXIR_LOOTS = 7,

  UNION_BUSTER = 12,
  WALL_BUSTER = 10,
  NICE_AND_TIDY = 4,
  SUPERB_WORK = 40,
  MONOLITH_MASHER = 45,
  GET_THOSE_GOBLINS = 2,
  ANTI_ARTILLERY = 23,
  SHATTERED_AND_SCATTERED = 37,
  COUNTER_SPELL = 44,
  X_BOW_EXTERMINATOR = 19,
  MORTAR_MAULER = 16,
  FIREFIGHTER = 20,
  MULTI_ARCHER_TOWER_TERMINATOR = 48,
  RICOCHET_CANNON_CRUSHER = 49,
  FIRESPITTER_FINISHER = 50,
  MULTI_GEAR_TOWER_TRAMPLER = 51,

  WAR_HERO = 21,
  WAR_LEAGUE_LEGEND = 34,
  SIEGE_SHARER = 41,
  FRIEND_IN_NEED = 15,
  SHARING_IS_CARING = 24,
}

export const SUPER_TROOP_SET = new Set(RAW_DATA.RAW_SUPER_UNITS.map((unit) => unit.name));
export const UNIT_ID_LIST = Object.values(UNITS_MAP_BY_NAME);
