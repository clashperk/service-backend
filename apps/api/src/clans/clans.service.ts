import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { JwtUser } from '../auth';
import { Collections, MONGODB_TOKEN } from '../db';
import { ClanMembersService } from './clan-members.service';
import { CapitalContributionDto, ClanLinksDto } from './dto';

const CLAN_LEADER_ROLES = ['leader', 'coLeader'];

@Injectable()
export class ClansService {
  constructor(
    private clashClientService: ClashClientService,
    private clanMembersService: ClanMembersService,
    @Inject(MONGODB_TOKEN) private db: Db,
  ) {}

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
