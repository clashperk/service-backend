import { Collections, Tokens } from '@app/constants';
import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import { MongoDbService } from './mongodb.service';

const MongoDbProvider: Provider = {
  provide: Tokens.MONGODB,
  useFactory: async (configService: ConfigService): Promise<Db> => {
    const client = await MongoClient.connect(configService.getOrThrow('MONGODB_URL'));
    return client.db(configService.getOrThrow('MONGODB_DB_NAME'));
  },
  inject: [ConfigService],
};

export const collectionProviders: Provider[] = Object.values(Collections).map((collection) => ({
  provide: collection,
  useFactory: async (db: Db) => {
    return db.collection(collection);
  },
  inject: [Tokens.MONGODB],
}));

@Module({
  providers: [MongoDbProvider, MongoDbService, ...collectionProviders],
  exports: [MongoDbProvider, MongoDbService, ...collectionProviders],
})
export class MongoDbModule {}
