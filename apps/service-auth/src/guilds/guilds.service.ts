import { Injectable } from '@nestjs/common';

@Injectable()
export class GuildsService {
  constructor() {}

  getMembers(guildId: string, q: string) {
    return [guildId, q];
  }

  getClans(guildId: string) {
    return [guildId];
  }
}
