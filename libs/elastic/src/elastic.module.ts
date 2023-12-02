import { Tokens } from '@app/constants';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticService } from './elastic.service';

export type { ElasticClient };

const ElasticProvider: Provider = {
  provide: Tokens.ELASTIC,
  useFactory: async (configService: ConfigService): Promise<ElasticClient> => {
    const elastic = new ElasticClient({
      node: configService.getOrThrow('ES_HOST'),
      auth: {
        username: 'elastic',
        password: configService.getOrThrow('ES_PASSWORD'),
      },
      tls: {
        ca: configService.getOrThrow('ES_CA_CRT'),
        rejectUnauthorized: false,
      },
    });
    return elastic;
  },
  inject: [ConfigService],
};

@Module({
  providers: [ElasticProvider, ElasticService],
  exports: [ElasticProvider, ElasticService],
})
export class ElasticModule {}
