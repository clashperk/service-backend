import { ClashClientService } from '@app/clash-client';
import { Collections, WarType } from '@app/constants';
import { ClanStoresEntity, ClanWarsEntity, SheetType } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import { APIWarClan } from 'clashofclans.js';
import { Collection } from 'mongodb';
import { ClanWarsExportInput } from './dto/clan-wars-export.dto';
import { CreateGoogleSheet, GoogleSheetService } from './google-sheet.service';

@Injectable()
export class ClanWarsExportsService {
  public constructor(
    @Inject(Collections.CLAN_WARS)
    private clanWarsRepository: Collection<ClanWarsEntity>,

    @Inject(Collections.CLAN_STORES)
    private clansRepository: Collection<ClanStoresEntity>,

    private coc: ClashClientService,
    private googleSheetService: GoogleSheetService,
  ) {}

  public async exec(input: ClanWarsExportInput) {
    const query = input.startDate ? { preparationStartTime: { $gte: input.startDate } } : {};
    const clans = await this.clansRepository
      .find({ guild: input.guildId, tag: { $in: input.clanTags } })
      .toArray();

    const chunks: { name: string; tag: string; members: AggregatedMember[] }[] = [];
    for (const { tag, name } of clans) {
      const cursor = this.clanWarsRepository
        .find({
          $or: [{ 'clan.tag': tag }, { 'opponent.tag': tag }],
          state: { $in: ['inWar', 'warEnded'] },
          warType:
            input.warType === 'regular-and-cwl'
              ? { $in: [WarType.REGULAR, WarType.CWL] }
              : input.warType === 'friendly'
              ? WarType.FRIENDLY
              : WarType.REGULAR,
          ...query,
        })
        .sort({ _id: -1 })
        .limit(input.limit);

      const members: { [key: string]: AggregatedMember } = {};
      for await (const war of cursor) {
        const clan: APIWarClan = war.clan.tag === tag ? war.clan : war.opponent;
        const attacks = clan.members
          .filter((m) => m.attacks?.length)
          .map((m) => m.attacks!)
          .flat();

        for (const m of clan.members) {
          members[m.tag] ??= {
            name: m.name,
            tag: m.tag,
            townHallLevel: m.townhallLevel,
            attacks: 0,
            stars: 0,
            trueStars: 0,
            dest: 0,
            defStars: 0,
            threeStars: 0,
            oneStars: 0,
            twoStars: 0,
            zeroStars: 0,
            defCount: 0,
            of: 0,
            defDestruction: 0,
            wars: 0,
          };

          const member = members[m.tag]!;
          member.of += war.attacksPerMember || 2;
          member.wars += 1;

          for (const atk of m.attacks ?? []) {
            const prev = this.coc.getPreviousBestAttack(attacks, atk);
            member.trueStars += Math.max(0, atk.stars - (prev?.stars ?? 0));

            if (atk.stars === 3) member.threeStars += 1;
            if (atk.stars === 2) member.twoStars += 1;
            if (atk.stars === 1) member.oneStars += 1;
            if (atk.stars === 0) member.zeroStars += 1;
          }

          if (m.attacks?.length) {
            member.attacks += m.attacks.length;
            member.stars += m.attacks.reduce((prev, atk) => prev + atk.stars, 0);
            member.dest += m.attacks.reduce((prev, atk) => prev + atk.destructionPercentage, 0);
          }

          if (m.bestOpponentAttack) {
            member.defStars += m.bestOpponentAttack.stars;
            member.defDestruction += m.bestOpponentAttack.destructionPercentage;
            member.defCount += 1;
          }
        }
      }

      chunks.push({
        name,
        tag,
        members: Object.values(members)
          .sort((a, b) => b.dest - a.dest)
          .sort((a, b) => b.stars - a.stars),
      });
    }

    const sheets: CreateGoogleSheet[] = chunks.map((chunk) => ({
      columns: [
        { name: 'Name', width: 160, align: 'LEFT' },
        { name: 'Tag', width: 120, align: 'LEFT' },
        { name: 'Town Hall', width: 100, align: 'RIGHT' },
        { name: 'War Count', width: 100, align: 'RIGHT' },
        { name: 'Total Attacks', width: 100, align: 'RIGHT' },
        { name: 'Total Stars', width: 100, align: 'RIGHT' },
        { name: 'Avg. Stars', width: 100, align: 'RIGHT' },
        { name: 'True Stars', width: 100, align: 'RIGHT' },
        { name: 'Avg. True Stars', width: 100, align: 'RIGHT' },
        { name: 'Total Dest', width: 100, align: 'RIGHT' },
        { name: 'Avg. Dest', width: 100, align: 'RIGHT' },
        { name: 'Three Stars', width: 100, align: 'RIGHT' },
        { name: 'Two Stars', width: 100, align: 'RIGHT' },
        { name: 'One Stars', width: 100, align: 'RIGHT' },
        { name: 'Zero Stars', width: 100, align: 'RIGHT' },
        { name: 'Missed', width: 100, align: 'RIGHT' },
        { name: 'Total Defenses', width: 100, align: 'RIGHT' },
        { name: 'Total Def Stars', width: 100, align: 'RIGHT' },
        { name: 'Avg. Def Stars', width: 100, align: 'RIGHT' },
        { name: 'Total Def Dest', width: 100, align: 'RIGHT' },
        { name: 'Avg. Def Dest', width: 100, align: 'RIGHT' },
        { name: `${chunk.name}`, width: 100, align: 'RIGHT' },
        { name: `${chunk.tag}`, width: 100, align: 'RIGHT' },
      ],
      rows: chunk.members.map((m) => [
        m.name,
        m.tag,
        m.townHallLevel,
        m.wars,
        m.of,
        m.stars,
        Number((m.stars / m.of || 0).toFixed(2)),
        m.trueStars,
        Number((m.trueStars / m.of || 0).toFixed(2)),
        Number(m.dest.toFixed(2)),
        Number((m.dest / m.of || 0).toFixed(2)),
        m.threeStars,
        m.twoStars,
        m.oneStars,
        m.zeroStars,
        m.of - m.attacks,
        m.defCount,
        m.defStars,
        Number((m.defStars / m.defCount || 0).toFixed(2)),
        Number(m.defDestruction.toFixed(2)),
        Number((m.defDestruction / m.defCount || 0).toFixed(2)),
      ]),
      title: `${chunk.name} (${chunk.tag})`,
    }));

    const result = await this.googleSheetService.createOrUpdateSheet({
      clans,
      guildId: input.guildId,
      label: 'Clan Wars Export',
      sheets,
      sheetType:
        input.warType === 'regular-and-cwl'
          ? SheetType.COMBINED_WARS
          : input.warType === 'friendly'
          ? SheetType.FRIENDLY_WARS
          : SheetType.REGULAR_WARS,
    });

    return result;
  }
}

interface AggregatedMember {
  name: string;
  tag: string;
  townHallLevel: number;
  attacks: number;
  stars: number;
  trueStars: number;
  dest: number;
  defStars: number;
  threeStars: number;
  twoStars: number;
  oneStars: number;
  zeroStars: number;
  defCount: number;
  of: number;
  defDestruction: number;
  wars: number;
}
