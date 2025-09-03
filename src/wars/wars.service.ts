import { ClashClientService } from '@app/clash-client';
import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { MONGODB_TOKEN } from '../db';

@Injectable()
export class WarsService {
  constructor(
    @Inject(MONGODB_TOKEN) private db: Db,
    private clashClientService: ClashClientService,
  ) {}

  async getClanWarLeague(clanTag: string) {
    const now = Date.now();
    const r = await this.clashClientService.getClanWarLeague(clanTag);
    console.log('CWL fetched in', Date.now() - now, 'ms');
    return r;
  }
}
