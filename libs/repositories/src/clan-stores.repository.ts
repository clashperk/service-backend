import { Collections } from '@app/constants';
import { ClanStoresEntity } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class ClanStoresRepository {
  constructor(
    @Inject(Collections.CLAN_STORES)
    public collection: Collection<ClanStoresEntity>,
  ) {}
}
