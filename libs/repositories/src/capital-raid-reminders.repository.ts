import { Collections } from '@app/constants';
import { CapitalRaidRemindersEntity } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class CapitalRaidRemindersRepository {
  constructor(
    @Inject(Collections.RAID_REMINDERS)
    public collection: Collection<CapitalRaidRemindersEntity>,
  ) {}
}
