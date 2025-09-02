import { Global, Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import { ApiUsersEntity, ClanStoresEntity, ClanWarsEntity, PlayerLinksEntity } from './collections';
import { Collections } from './db.constants';

export const MONGODB_TOKEN = 'MONGODB_TOKEN';

interface CollectionRecords {
  [Collections.CLAN_STORES]: ClanStoresEntity;
  [Collections.PORTAL_USERS]: ApiUsersEntity;
  [Collections.PLAYER_LINKS]: PlayerLinksEntity;
  [Collections.CLAN_WARS]: ClanWarsEntity;
}

declare module 'mongodb' {
  interface Db {
    collection<T extends keyof CollectionRecords>(name: T): Collection<CollectionRecords[T]>;
  }
}

@Global()
@Module({
  providers: [
    {
      provide: MONGODB_TOKEN,
      useFactory: (configService: ConfigService): Db => {
        return new MongoClient(configService.getOrThrow('MONGODB_URL')).db(
          configService.getOrThrow('MONGODB_DATABASE'),
        );
      },
      inject: [ConfigService],
    },
  ],
  exports: [MONGODB_TOKEN],
})
export class MongoDbModule {
  constructor(@Inject(MONGODB_TOKEN) private db: Db) {}

  onModuleInit() {
    this.db.command({ ping: 1 }); // eslint-disable-line
  }
}
