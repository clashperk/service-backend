import { Injectable } from '@nestjs/common';

@Injectable()
export class ClansService {
  constructor() {}

  getCapitalContribution(clanTag: string) {
    return { clanTag };
  }

  getClanWar(clanTag: string, warId: string) {
    return { clanTag, warId };
  }
}
