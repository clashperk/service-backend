import { Tokens } from '@app/constants';
import { Client as ElasticClient } from '@elastic/elasticsearch';
import { Inject, Module, OnApplicationShutdown, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticService } from './elastic.service';

export type { ElasticClient };

const ElasticProvider: Provider = {
  provide: Tokens.ELASTIC,
  useFactory: async (configService: ConfigService): Promise<ElasticClient> => {
    const client = new ElasticClient({
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
    return client;
  },
  inject: [ConfigService],
};

@Module({
  providers: [ElasticProvider, ElasticService],
  exports: [ElasticProvider, ElasticService],
})
export class ElasticModule implements OnApplicationShutdown {
  constructor(@Inject(Tokens.ELASTIC) private client: ElasticClient) {}

  onApplicationShutdown() {
    return this.client.close();
  }
}
