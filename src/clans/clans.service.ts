import { ClashClientService } from '@app/clash-client';
import { Injectable } from '@nestjs/common';
import { ClanMembersService } from './clan-members.service';

@Injectable()
export class ClansService {
  constructor(
    private clashClientService: ClashClientService,
    private clanMembersService: ClanMembersService,
  ) {}

  async getLastSeen(clanTag: string) {
    const clan = await this.clashClientService.getClanOrThrow(clanTag);
    const playerTags = clan.memberList.map((m) => m.tag);

    return this.clanMembersService.getLastSeen(playerTags);
  }
}
