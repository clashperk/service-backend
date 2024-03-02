import { Collections } from '@app/constants';
import { PlayersEntity } from '@app/entities';
import { Inject, Injectable } from '@nestjs/common';
import { Collection } from 'mongodb';

@Injectable()
export class PlayersRepository {
  constructor(
    @Inject(Collections.LAST_SEEN)
    public collection: Collection<PlayersEntity>,
  ) {}
}
