import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { JwtUser } from '../auth';
import { Collections, MONGODB_TOKEN } from '../db';
import { ClanMembersService } from './clan-members.service';
import {
  CLAN_GAMES_MAX_POINTS,
  clanGamesWindow,
  latestClanGamesSeason,
} from '../events/game-calendar';
import { CapitalContributionDto, CapitalRaidsDto, ClanGamesDto, ClanLinksDto } from './dto';

const CLAN_LEADER_ROLES = ['leader', 'coLeader'];

@Injectable()
export class ClansService {
  constructor(
    private clashClientService: ClashClientService,
    private clanMembersService: ClanMembersService,
    @Inject(MONGODB_TOKEN) private db: Db,
  ) {}

  async getClanGames(
    clanTag: string,
    season = latestClanGamesSeason(new Date()),
  ): Promise<ClanGamesDto> {
    const players = await this.db
      .collection(Collections.CLAN_GAMES_POINTS)
      .find(
        { __clans: clanTag, season },
        { projection: { name: 1, tag: 1, initial: 1, current: 1, completedAt: 1 } },
      )
      .limit(60)
      .toArray();

    // Most points first; among members who hit the cap, whoever finished first.
    const members = players
      .map((player) => ({
        name: player.name,
        tag: player.tag,
        points: player.current - player.initial,
        completedAt: player.completedAt ?? null,
      }))
      .sort(
        (a, b) =>
          b.points - a.points ||
          (a.completedAt?.getTime() ?? Infinity) - (b.completedAt?.getTime() ?? Infinity),
      );

    return {
      season,
      ...clanGamesWindow(season),
      maxPoints: CLAN_GAMES_MAX_POINTS,
      totalPoints: members.reduce((sum, m) => sum + Math.min(m.points, CLAN_GAMES_MAX_POINTS), 0),
      members,
    };
  }

  async getClan(clanTag: string) {
    return this.clashClientService.getClanOrThrow(clanTag);
  }

  async getLastSeen(clanTag: string) {
    const clan = await this.clashClientService.getClanOrThrow(clanTag);
    const playerTags = clan.memberList.map((m) => m.tag);

    return { items: await this.clanMembersService.getLastSeen(playerTags) };
  }

  async getCapitalContribution(clanTag: string, season?: string): Promise<CapitalContributionDto> {
    const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);

    const items = await this.db
      .collection(Collections.CAPITAL_CONTRIBUTIONS)
      .find(
        { 'clan.tag': clanTag, ...(season ? { season } : { createdAt: { $gt: createdAt } }) },
        { projection: { _id: 0 } },
      )
      .sort({ _id: -1 })
      .toArray();

    return { items };
  }

  async getCapitalRaids(clanTag: string, limit: number): Promise<CapitalRaidsDto> {
    const items = await this.db
      .collection(Collections.CAPITAL_RAID_SEASONS)
      .find(
        { tag: clanTag },
        {
          projection: {
            _id: 0,
            weekId: 0,
            badgeURL: 0,
            clanCapitalPoints: 0,
            capitalLeague: 0,
            _clanCapitalPoints: 0,
            _capitalLeague: 0,
            createdAt: 0,
            updatedAt: 0,
          },
        },
      )
      .sort({ weekId: -1 })
      .limit(limit)
      .toArray();

    return { items };
  }

  async getClanLinks(clanTag: string, user: JwtUser): Promise<ClanLinksDto> {
    const clan = await this.clashClientService.getClanOrThrow(clanTag);
    const playerTags = clan.memberList.map((member) => member.tag);

    const [links, userLinks] = await Promise.all([
      this.links.find({ tag: { $in: playerTags } }).toArray(),
      this.links.find({ userId: user.userId, verified: true }).toArray(),
    ]);

    const linksMap = new Map(links.map((link) => [link.tag, link]));
    const userTags = new Set(userLinks.map((link) => link.tag));
    const isLeader = clan.memberList.some(
      (member) => userTags.has(member.tag) && CLAN_LEADER_ROLES.includes(member.role),
    );
    const isAdmin = JwtUser.isAdmin(user);

    return {
      name: clan.name,
      tag: clan.tag,
      members: clan.members,
      memberList: clan.memberList.map((member) => {
        const link = linksMap.get(member.tag);
        const isOwner = link?.userId === user.userId;
        const isLinker = link?.linkedBy === user.userId;

        return {
          name: member.name,
          tag: member.tag,
          role: member.role,
          townHallLevel: member.townHallLevel,
          userId: link?.userId ?? null,
          username: link?.username ?? null,
          displayName: link?.displayName ?? null,
          verified: !!link?.verified,
          deletable: !!link && (isAdmin || isOwner || (!link.verified && (isLinker || isLeader))),
        };
      }),
    };
  }

  private get links() {
    return this.db.collection(Collections.PLAYER_LINKS);
  }
}
