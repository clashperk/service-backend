import { ApiUsersEntity, ClanStoresEntity, PlayerLinksEntity } from './collections';

export enum Collections {
  CLAN_STORES = 'ClanStores',
  API_USERS = 'ApiUsers',
  PLAYER_LINKS = 'PlayerLinks',
}

interface CollectionRecords {
  [Collections.CLAN_STORES]: ClanStoresEntity;
  [Collections.API_USERS]: ApiUsersEntity;
  [Collections.PLAYER_LINKS]: PlayerLinksEntity;
}

declare module 'mongodb' {
  interface Db {
    collection<T extends keyof CollectionRecords>(name: T): Collection<CollectionRecords[T]>;
  }
}
