import {
  calculateRushedPercentage,
  ClashClientService,
  HERO_EQUIPMENT,
  HERO_PETS,
  HOME_HEROES,
  HOME_TROOPS,
  remainingHeroUpgrades,
  remainingLabUpgrades,
  ROLES_MAP,
} from '@app/clash-client';
import { QueueTypes } from '@app/constants';
import { CreateGoogleSheet } from '@app/google-sheet';
import { InjectQueue } from '@nestjs/bull';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { sum } from 'lodash';
import { Db } from 'mongodb';
import { Collections, MONGODB_TOKEN, PlayerLinksEntity } from '../db';
import { ExportMembersInput, ExportSheetInputDto } from './dto';
import { ReusableSheetService, SheetType } from './services/reusable-sheet.service';

const ALLOWED_ACHIEVEMENTS = [
  'Gold Grab',
  'Elixir Escapade',
  'Heroic Heist',
  'Games Champion',
  'War League Legend',
  'Unbreakable',
  'Conqueror',
  'Siege Sharer',
  'Sharing is caring',
  'Friend in Need',
  'Aggressive Capitalism',
  'Most Valuable Clanmate',
];

@Injectable()
export class ExportsMembersService {
  constructor(
    @InjectQueue(QueueTypes.EXPORT) private queue: Queue<ExportSheetInputDto>,
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
    private reusableSheetService: ReusableSheetService,
  ) {}

  async exportClanMembers(input: ExportMembersInput) {
    const clans = await this.clashClientService.getClans(input.clanTags);
    const chunks: MembersChunk[] = [];

    for (const clan of clans) {
      clan.memberList.sort((a, b) => b.clanRank - a.clanRank);

      const playerTags = clan.memberList.map((member) => member.tag);
      const players = await this.clashClientService.getPlayers(playerTags);

      const links = await this.links.find({ tag: { $in: playerTags } }).toArray();
      const linksMap = links.reduce<Record<string, PlayerLinksEntity>>((record, link) => {
        record[link.tag] = link;
        return record;
      }, {});

      players.forEach((player, idx) => {
        const achievements = player.achievements.reduce<Record<string, number>>(
          (record, achievement) => {
            if (ALLOWED_ACHIEVEMENTS.includes(achievement.name)) {
              record[achievement.name] = achievement.value;
            }
            return record;
          },
          {} as Record<string, number>,
        );

        const troops = [
          ...player.troops,
          ...player.spells,
          ...player.heroes,
          ...player.heroEquipment,
        ].reduce(
          (record, troop) => {
            if (HOME_TROOPS.includes(troop.name) && troop.village === 'home') {
              record[troop.name] = troop.level;
            }
            return record;
          },
          {} as Record<string, number>,
        );

        const pets = player.troops.reduce(
          (record, pet) => {
            if (HERO_PETS.includes(pet.name)) {
              record[pet.name] = pet.level;
            }
            return record;
          },
          {} as Record<string, number>,
        );

        const heroes = player.heroes.reduce(
          (record, hero) => {
            if (HOME_HEROES.includes(hero.name)) {
              record[hero.name] = hero.level;
            }
            return record;
          },
          {} as Record<string, number>,
        );

        const equipment = player.heroEquipment.reduce(
          (record, hero) => {
            if (HERO_EQUIPMENT.includes(hero.name)) record[hero.name] = hero.level;
            return record;
          },
          {} as Record<string, number>,
        );

        chunks.push({
          clan: {
            name: clan.name,
            tag: clan.tag,
          },
          tag: player.tag,
          name: player.name,
          role: ROLES_MAP[player.role!],
          trophies: player.trophies,
          leagueTier: player.leagueTier?.name || 'Unranked',
          clanRank: idx + 1,
          townHallLevel: player.townHallLevel,
          warPreference: player.warPreference!,

          achievements: ALLOWED_ACHIEVEMENTS.map((name) => ({
            name,
            value: achievements[name] || 0,
          })),
          troops: HOME_TROOPS.map((name) => ({ name, level: troops[name] || 0 })),
          pets: HERO_PETS.map((name) => ({ name, level: pets[name] || 0 })),
          heroes: HOME_HEROES.map((name) => ({ name, level: heroes[name] || 0 })),
          equipment: HERO_EQUIPMENT.map((name) => ({ name, level: equipment[name] || 0 })),

          rushedPercentage: Number(calculateRushedPercentage(player)),
          remainingHeroUpgradesPercentage: Number(remainingHeroUpgrades(player)),
          remainingLabUpgradesPercentage: Number(remainingLabUpgrades(player)),

          userId: linksMap[player.tag]?.userId,
          username: linksMap[player.tag]?.username,
          displayName: linksMap[player.tag]?.displayName,
        });
      });
    }

    chunks.sort((a, b) => b.townHallLevel - a.townHallLevel);
    chunks.sort((a, b) => sum(b.heroes.map((x) => x.level)) - sum(a.heroes.map((x) => x.level)));

    const sheets: CreateGoogleSheet[] = [
      {
        columns: [
          { name: 'NAME', width: 160, align: 'LEFT' },
          { name: 'TAG', width: 120, align: 'LEFT' },
          { name: 'Discord', width: 160, align: 'LEFT' },
          { name: 'Username', width: 160, align: 'LEFT' },
          { name: 'ID', width: 160, align: 'LEFT' },
          { name: 'CLAN', width: 160, align: 'LEFT' },
          { name: 'ROLE', width: 100, align: 'LEFT' },
          { name: 'Trophies', width: 100, align: 'LEFT' },
          { name: 'League Tier', width: 160, align: 'LEFT' },
          { name: 'War Preference', width: 100, align: 'LEFT' },
          { name: 'Town-Hall', width: 100, align: 'RIGHT' },
          { name: 'Rushed %', width: 100, align: 'RIGHT' },
          { name: 'Lab Upgrades Done', width: 100, align: 'RIGHT' },
          { name: 'Hero Upgrades Done', width: 100, align: 'RIGHT' },
          ...HOME_HEROES.map((name) => ({ name, width: 100, align: 'RIGHT' })),
          ...HERO_PETS.map((name) => ({ name, width: 100, align: 'RIGHT' })),
          ...ALLOWED_ACHIEVEMENTS.map((name) => ({ name, width: 100, align: 'RIGHT' })),
        ],
        rows: chunks.map((m) => [
          m.name,
          m.tag,
          m.displayName,
          m.username,
          m.userId,
          m.clan.name,
          m.role,
          m.trophies,
          m.leagueTier,
          m.warPreference,
          m.townHallLevel,
          m.rushedPercentage,
          m.remainingLabUpgradesPercentage,
          m.remainingHeroUpgradesPercentage,
          ...m.heroes.map((h) => h.level),
          ...m.pets.map((h) => h.level),
          ...m.achievements.map((v) => v.value),
        ]),
        title: 'All Members',
      },
      {
        title: 'Units',
        columns: [
          { name: 'NAME', width: 160, align: 'LEFT' },
          { name: 'TAG', width: 120, align: 'LEFT' },
          { name: 'Town-Hall', width: 100, align: 'RIGHT' },
          { name: 'Rushed %', width: 100, align: 'RIGHT' },
          ...HOME_TROOPS.map((name) => ({ name, width: 100, align: 'RIGHT' })),
        ],
        rows: chunks.map((m) => [
          m.name,
          m.tag,
          m.townHallLevel,
          m.rushedPercentage,
          ...m.troops.map((h) => h.level),
        ]),
      },
      {
        title: 'Equipment',
        columns: [
          { name: 'NAME', width: 160, align: 'LEFT' },
          { name: 'TAG', width: 120, align: 'LEFT' },
          { name: 'Town-Hall', width: 100, align: 'RIGHT' },
          ...HERO_EQUIPMENT.map((name) => ({ name, width: 100, align: 'RIGHT' })),
        ],
        rows: chunks.map((m) => [
          m.name,
          m.tag,
          m.townHallLevel,
          ...m.equipment.map((h) => h.level),
        ]),
      },
    ];

    return this.reusableSheetService.createOrUpdateSheet({
      clanTags: input.clanTags,
      sheets,
      guildId: input.guildId,
      label: 'Clan Members',
      scheduled: input.scheduled,
      sheetType: SheetType.CLAN_MEMBERS,
    });
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }
}

interface MembersChunk {
  name: string;
  tag: string;
  clan: {
    name: string;
    tag: string;
  };
  role: string;
  clanRank: number;
  trophies: number;
  leagueTier: string;
  warPreference: string;
  townHallLevel: number;

  rushedPercentage: number;
  remainingHeroUpgradesPercentage: number;
  remainingLabUpgradesPercentage: number;

  userId: string;
  username: string;
  displayName: string;

  achievements: {
    name: string;
    value: number;
  }[];
  troops: {
    name: string;
    level: number;
  }[];
  pets: {
    name: string;
    level: number;
  }[];
  heroes: {
    name: string;
    level: number;
  }[];
  equipment: {
    name: string;
    level: number;
  }[];
}
