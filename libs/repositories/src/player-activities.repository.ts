import { Collections } from '@app/constants';
import { PlayerActivitiesEntity } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class PlayerActivitiesRepository {
  constructor(
    @Inject(Collections.PLAYER_ACTIVITIES)
    public collection: Collection<PlayerActivitiesEntity>,
  ) {}
}
