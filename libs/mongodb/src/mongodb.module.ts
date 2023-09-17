import { Tokens } from '@app/constants';
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

@Module({
  providers: [MongodbProvider, MongodbService],
  exports: [MongodbProvider, MongodbService],
})
export class MongodbModule {}
