import { ClashClientService } from '@app/clash-client';
import { Collections } from '@app/constants';
import {
  CWLGroupsEntity,
  CapitalContributionsEntity,
  CapitalRaidSeasonsEntity,
  ClanWarsEntity,
  PlayerLinksEntity,
} from '@app/entities';
import { getPreviousBestAttack } from '@app/helper';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APIClanWarAttack, APIWarClan } from 'clashofclans.js';
import { Collection, Filter } from 'mongodb';
import { CWLMemberStatsOutput, CWLStatsOutput } from './dto/cwl-stats.dto';

@Injectable()
export class ClansService {
  constructor(
    private clashClientService: ClashClientService,
    @Inject(Collections.PLAYER_LINKS)
    private playerLinksCollection: Collection<PlayerLinksEntity>,
    @Inject(Collections.CLAN_WARS) private clanWarsCollection: Collection<ClanWarsEntity>,
    @Inject(Collections.CWL_GROUPS) private cwlGroupsCollection: Collection<CWLGroupsEntity>,
    @Inject(Collections.CAPITAL_CONTRIBUTIONS)
    private capitalContributionsCollection: Collection<CapitalContributionsEntity>,
    @Inject(Collections.CAPITAL_RAID_SEASONS)
    private capitalRaidsCollection: Collection<CapitalRaidSeasonsEntity>,
  ) {}

  getCapitalRaids(clanTag: string, limit: number) {
    return this.capitalRaidsCollection
      .find({ tag: clanTag })
      .sort({ _id: -1 })
      .project({
        _clanCapitalPoints: 0,
        clanCapitalPoints: 0,
        _capitalLeague: 0,
        capitalLeague: 0,
        updatedAt: 0,
        createdAt: 0,
        badgeURL: 0,
        weekId: 0,
        _id: 0,
      })
      .allowDiskUse(true)
      .limit(limit)
      .toArray();
  }

  getCapitalContributions(clanTag: string, seasonId?: string) {
    const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);

    const filter: Filter<CapitalContributionsEntity> = {};
    if (seasonId) filter.season = seasonId;
    else filter.createdAt = { $gt: createdAt };

    return this.capitalContributionsCollection
      .find({ 'clan.tag': clanTag, ...filter })
      .sort({ _id: -1 })
      .toArray();
  }

  async getLinkedMembers(authUserId: string, clanTag: string) {
    const clan = await this.clashClientService.getClanOrThrow(clanTag);

    const memberList = clan.memberList.map((mem) => ({
      tag: mem.tag,
      name: mem.name,
      role: mem.role,
      townHallLevel: mem.townHallLevel,
    }));

    const [links, userLinks] = await Promise.all([
      this.playerLinksCollection.find({ tag: { $in: memberList.map((mem) => mem.tag) } }).toArray(),
      this.playerLinksCollection.find({ userId: authUserId, verified: true }).toArray(),
    ]);

    const clanLeaders = memberList
      .filter((member) => ['leader', 'coLeader'].includes(member.role))
      .map((mem) => mem.tag);

    const authUserTags = userLinks.map((link) => link.tag);
    const linksMap = Object.fromEntries(links.map((link) => [link.tag, link]));

    return {
      name: clan.name,
      tag: clan.tag,
      members: clan.members,
      memberList: memberList.map((member) => {
        const user = linksMap[member.tag];
        return {
          ...member,
          userId: user?.userId,
          username: user?.username,
          verified: user?.verified,
          deletable: !user?.verified && authUserTags.some((tag) => clanLeaders.includes(tag)),
        };
      }),
    };
  }

  public async getClanWar(clanTag: string, warId: string) {
    const body = await this.clanWarsCollection.findOne(
      { id: Number(warId) },
      {
        projection: {
          uid: 0,
          warType: 0,
          updatedAt: 0,
          createdAt: 0,
          season: 0,
        },
      },
    );
    if (!body) throw new NotFoundException('War not found');

    const clan = [body.clan.tag, body.opponent.tag].includes(clanTag)
      ? body.clan.tag === clanTag
        ? body.clan
        : body.opponent
      : body.clan;
    const opponent = body.clan.tag === clan.tag ? body.opponent : body.clan;

    const __attacks = clan.members
      .filter((member) => member.attacks?.length)
      .map((m) => m.attacks as APIClanWarAttack[])
      .flat()
      .sort((a, b) => a.order - b.order)
      .map((atk, _, __attacks) => {
        const defender = opponent.members.find((m) => m.tag === atk.defenderTag);
        const defenderDefenses = __attacks.filter((atk) => atk.defenderTag === defender?.tag);
        const isFresh =
          defenderDefenses.length === 0 ||
          atk.order === Math.min(...defenderDefenses.map((d) => d.order));
        const previousBestAttack = isFresh
          ? null
          : [...__attacks]
              .filter(
                (_atk) =>
                  _atk.defenderTag === defender?.tag &&
                  _atk.order < atk.order &&
                  _atk.attackerTag !== atk.attackerTag,
              )
              .sort(
                (a, b) => b.destructionPercentage ** b.stars - a.destructionPercentage ** a.stars,
              )
              .at(0) ?? null;

        return {
          ...atk,
          isFresh,
          oldStars: previousBestAttack?.stars ?? 0,
          defender: {
            name: defender?.name,
            tag: defender?.tag,
            townhallLevel: defender?.townhallLevel,
            mapPosition: defender?.mapPosition,
          },
        };
      });

    const __defenses = opponent.members
      .filter((member) => member.attacks?.length)
      .map((m) => m.attacks as APIClanWarAttack[])
      .flat()
      .sort((a, b) => a.order - b.order)
      .map((atk, _, __defenses) => {
        const defender = clan.members.find((m) => m.tag === atk.defenderTag);
        const defenderDefenses = __defenses.filter((atk) => atk.defenderTag === defender?.tag);
        const isFresh =
          defenderDefenses.length === 0 ||
          atk.order === Math.min(...defenderDefenses.map((d) => d.order));
        const previousBestAttack = isFresh
          ? null
          : [...__defenses]
              .filter(
                (_atk) =>
                  _atk.defenderTag === defender?.tag &&
                  _atk.order < atk.order &&
                  _atk.attackerTag !== atk.attackerTag,
              )
              .sort(
                (a, b) => b.destructionPercentage ** b.stars - a.destructionPercentage ** a.stars,
              )
              .at(0) ?? null;

        return {
          ...atk,
          isFresh,
          oldStars: previousBestAttack?.stars ?? 0,
          defender: {
            name: defender?.name,
            tag: defender?.tag,
            townhallLevel: defender?.townhallLevel,
            mapPosition: defender?.mapPosition,
          },
        };
      });

    clan.members
      .sort((a, b) => a.mapPosition - b.mapPosition)
      .map((member, n) => ({ ...member, mapPosition: n + 1 }));
    opponent.members
      .sort((a, b) => a.mapPosition - b.mapPosition)
      .map((member, n) => ({ ...member, mapPosition: n + 1 }));

    return {
      ...body,
      clan: {
        ...clan,
        members: clan.members.map((member) => {
          const attacks = __attacks.filter((a) => a.attackerTag === member.tag);
          const defenses = __defenses.filter((d) => d.defenderTag === member.tag);

          return {
            name: member.name,
            tag: member.tag,
            townhallLevel: member.townhallLevel,
            mapPosition: member.mapPosition,
            attacks,
            defenses,
          };
        }),
      },
      opponent: {
        ...opponent,
        members: opponent.members.map((member) => {
          const attacks = __defenses.filter((a) => a.attackerTag === member.tag);
          const defenses = __attacks.filter((d) => d.defenderTag === member.tag);
          return {
            name: member.name,
            tag: member.tag,
            townhallLevel: member.townhallLevel,
            mapPosition: member.mapPosition,
            attacks,
            defenses,
          };
        }),
      },
      result: this.getWarResult(clan, opponent),
    };
  }

  public async getCWLStats(clanTag: string): Promise<CWLStatsOutput> {
    const body = await this.cwlGroupsCollection.findOne(
      { 'clans.tag': clanTag },
      { sort: { _id: -1 } },
    );
    if (!body) throw new NotFoundException('Clan war league group not found');

    const membersMap: Record<string, CWLMemberStatsOutput> = {};

    const wars = await this.clanWarsCollection
      .find(
        { warTag: { $in: body.warTags[clanTag] } },
        {
          projection: {
            _id: 0,
            id: 0,
            uid: 0,
            leagueGroupId: 0,
            warType: 0,
            updatedAt: 0,
            season: 0,
          },
        },
      )
      .toArray();

    for (const data of wars) {
      if (!(data.clan.tag === clanTag || data.opponent.tag === clanTag)) continue;
      if (!['inWar', 'warEnded'].includes(data.state)) continue;

      const clan = data.clan.tag === clanTag ? data.clan : data.opponent;
      const opponent = data.clan.tag === clanTag ? data.opponent : data.clan;
      clan.members.sort((a, b) => a.mapPosition - b.mapPosition);
      opponent.members.sort((a, b) => a.mapPosition - b.mapPosition);

      const __attacks = clan.members.flatMap((m) => m.attacks ?? []);
      for (const m of clan.members) {
        membersMap[m.tag] ??= {
          name: m.name,
          tag: m.tag,
          participated: 0,
          attacks: 0,
          stars: 0,
          newStars: 0,
          destruction: 0,
          threeStars: 0,
          twoStars: 0,
          oneStar: 0,
          zeroStars: 0,
          missedAttacks: 0,
          defenseStars: 0,
          defenseDestruction: 0,
          defenseCount: 0,
        };

        const member = membersMap[m.tag]!;
        member.participated += 1;

        for (const atk of m.attacks ?? []) {
          const previousBestAttack = getPreviousBestAttack(__attacks, opponent, atk);
          member.attacks += 1;
          member.stars += atk.stars;
          member.newStars += previousBestAttack
            ? Math.max(0, atk.stars - previousBestAttack.stars)
            : atk.stars;
          member.destruction += atk.destructionPercentage;
          member.threeStars += atk.stars === 3 ? 1 : 0;
          member.twoStars += atk.stars === 2 ? 1 : 0;
          member.oneStar += atk.stars === 1 ? 1 : 0;
          member.zeroStars += atk.stars === 0 ? 1 : 0;
        }

        member.missedAttacks += m.attacks?.length ? 0 : 1;

        if (m.bestOpponentAttack) {
          member.defenseStars += m.bestOpponentAttack.stars;
          member.defenseDestruction += m.bestOpponentAttack.destructionPercentage;
          member.defenseCount += 1;
        }
      }
    }

    const members = Object.values(membersMap);
    members.sort((a, b) => b.stars - a.stars);

    return {
      season: body.season,
      clans: body.clans,
      rounds: body.rounds,
      warTags: body.warTags[clanTag] ?? [],
      members,
      wars,
    };
  }

  private getWarResult(clan: APIWarClan, opponent: APIWarClan) {
    if (clan.stars === opponent.stars) {
      if (clan.destructionPercentage === opponent.destructionPercentage) return 'tied';
      if (clan.destructionPercentage > opponent.destructionPercentage) return 'won';
    }
    if (clan.stars > opponent.stars) return 'won';
    return 'lost';
  }

  public async getClanBadges(clanTag: string, size: string) {
    const clan = await this.clashClientService.getClanOrThrow(clanTag);
    console.log(clan.badgeUrls[size]);
    return fetch(clan.badgeUrls[size]).then((res) => res.arrayBuffer());
  }
}
