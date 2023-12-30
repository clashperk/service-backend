import { Collections } from '@app/constants';
import { CapitalRaidSeasonsEntity } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class CapitalRaidSeasonsRepository {
  constructor(
    @Inject(Collections.CAPITAL_RAID_SEASONS)
    public collection: Collection<CapitalRaidSeasonsEntity>,
  ) {}
}
