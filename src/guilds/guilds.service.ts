import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { PlayerLinksEntity } from '../db';
import { MONGODB_TOKEN } from '../db/mongodb.module';

@Injectable()
export class GuildsService {
  constructor(@Inject(MONGODB_TOKEN) private readonly db: Db) {}

  getSettings(guildId: string) {
    return { guildId } as unknown as PlayerLinksEntity;
  }
}
