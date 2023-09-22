import { Collections, Tokens } from '@app/constants';
import { Module, Provider } from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';
import { MongodbService } from './mongodb.service';

const MongodbProvider: Provider = {
  provide: Tokens.MONGODB,
  useFactory: async (): Promise<Db> => {
    const client = await MongoClient.connect(process.env.MONGODB_URL!);
    return client.db(process.env.MONGODB_DB_NAME);
  },
};

export const collectionProviders: Provider[] = Object.values(Collections).map((collection) => ({
  provide: collection,
  useFactory: async (db: Db) => {
    return db.collection(collection);
  },
  inject: [Tokens.MONGODB],
}));

@Module({
  providers: [MongodbProvider, MongodbService, ...collectionProviders],
  exports: [MongodbProvider, MongodbService, ...collectionProviders],
})
export class MongodbModule {}
