import { Collections, Tokens } from '@app/constants';
import {
  Global,
  Inject,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import { MongoDbService } from './mongodb.service';

export const MONGO_CLIENT = 'MONGO_CLIENT';

const MongoClientProvider: Provider = {
  provide: MONGO_CLIENT,
  useFactory: async (configService: ConfigService): Promise<MongoClient> => {
    return new MongoClient(configService.getOrThrow('MONGODB_URL'));
  },
  inject: [ConfigService],
};

const MongoDbProvider: Provider = {
  provide: Tokens.MONGODB,
  useFactory: async (client: MongoClient, configService: ConfigService): Promise<Db> => {
    return client.db(configService.getOrThrow('MONGODB_DB_NAME'));
  },
  inject: [MONGO_CLIENT, ConfigService],
};

export const collectionProviders: Provider[] = Object.values(Collections).map((collection) => ({
  provide: collection,
  useFactory: async (db: Db) => {
    return db.collection(collection);
  },
  inject: [Tokens.MONGODB],
}));

@Global()
@Module({
  providers: [MongoClientProvider, MongoDbProvider, MongoDbService, ...collectionProviders],
  exports: [MongoDbProvider, MongoDbService, ...collectionProviders],
})
export class MongoDbModule implements OnModuleInit, OnApplicationShutdown {
  constructor(@Inject(MONGO_CLIENT) private client: MongoClient) {}

  onModuleInit() {
    return this.client.connect();
  }

  onApplicationShutdown() {
    return this.client.close();
  }
}
