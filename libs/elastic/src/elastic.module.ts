import { Tokens } from '@app/constants';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { Module, Provider } from '@nestjs/common';
import { ElasticService } from './elastic.service';

export type { ElasticClient };

const ElasticProvider: Provider = {
  provide: Tokens.ELASTIC,
  useFactory: async (): Promise<ElasticClient> => {
    const elastic = new ElasticClient({
      node: process.env.ES_HOST,
      auth: {
        username: 'elastic',
        password: process.env.ES_PASSWORD!,
      },
      tls: {
        ca: process.env.ES_CA_CRT,
        rejectUnauthorized: false,
      },
    });
    return elastic;
  },
};

@Module({
  providers: [ElasticProvider, ElasticService],
  exports: [ElasticProvider, ElasticService],
})
export class ElasticModule {}
