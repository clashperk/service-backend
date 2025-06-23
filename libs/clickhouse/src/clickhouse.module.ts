import { createClient } from '@clickhouse/client';
import { NodeClickHouseClient } from '@clickhouse/client/dist/client';
import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClickhouseService } from './clickhouse.service';

export const CLICKHOUSE_CLIENT = 'CLICKHOUSE_CLIENT';

const MongoClientProvider: Provider = {
  provide: CLICKHOUSE_CLIENT,
  useFactory: async (configService: ConfigService): Promise<NodeClickHouseClient> => {
    return createClient({
      url: configService.getOrThrow('CLICKHOUSE_HOST'),
      username: configService.getOrThrow('CLICKHOUSE_USER'),
      password: configService.getOrThrow('CLICKHOUSE_PASSWORD'),
    });
  },
  inject: [ConfigService],
};

@Global()
@Module({
  providers: [ClickhouseService, MongoClientProvider],
  exports: [ClickhouseService, MongoClientProvider],
})
export class ClickhouseModule {}
