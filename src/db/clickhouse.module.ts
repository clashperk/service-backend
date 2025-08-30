import { createClient } from '@clickhouse/client';
import { NodeClickHouseClient } from '@clickhouse/client/dist/client';
import { Global, Inject, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const CLICKHOUSE_TOKEN = 'CLICKHOUSE_TOKEN';

@Global()
@Module({
  providers: [
    {
      provide: CLICKHOUSE_TOKEN,
      useFactory: (configService: ConfigService): NodeClickHouseClient => {
        return createClient({
          url: configService.getOrThrow<string>('CLICKHOUSE_HOST'),
          username: configService.getOrThrow<string>('CLICKHOUSE_USER'),
          password: configService.getOrThrow<string>('CLICKHOUSE_PASSWORD'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [CLICKHOUSE_TOKEN],
})
export class ClickhouseModule {
  constructor(@Inject(CLICKHOUSE_TOKEN) private clickhouse: NodeClickHouseClient) {}

  onModuleInit() {
    this.clickhouse.ping(); // eslint-disable-line
  }
}
