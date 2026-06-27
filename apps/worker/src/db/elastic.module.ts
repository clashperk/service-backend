import { Client as Elastic } from '@elastic/elasticsearch';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type { Elastic };

export const ELASTIC_TOKEN = 'ELASTIC_TOKEN';

@Global()
@Module({
  providers: [
    {
      provide: ELASTIC_TOKEN,
      useFactory: (configService: ConfigService): Elastic => {
        const client = new Elastic({
          node: configService.getOrThrow('ES_HOST'),
          auth: {
            username: 'elastic',
            password: configService.getOrThrow('ES_PASSWORD'),
          },
          tls: {
            ca: configService.getOrThrow('ES_CA_CRT'),
          },
        });
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [ELASTIC_TOKEN],
})
export class ElasticModule {}
