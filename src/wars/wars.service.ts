import { Inject, Injectable } from '@nestjs/common';
import { Db } from 'mongodb';
import { MONGODB_TOKEN } from '../db';

@Injectable()
export class WarsService {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  async getClanWarLeagues() {}
}
