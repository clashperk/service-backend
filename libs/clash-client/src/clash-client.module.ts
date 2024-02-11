import { Tokens } from '@app/constants';
import { RedisModule } from '@app/redis';
import { Logger, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  QueueThrottler,
  RESTManager,
  RequestHandler,
  RequestOptions,
  Result,
} from 'clashofclans.js';
import { ClashClientService } from './clash-client.service';

class ReqHandler extends RequestHandler {
  private readonly logger = new Logger('ClashApiRest');

  public async request<T>(path: string, options: RequestOptions = {}): Promise<Result<T>> {
    const result = await super.request<T>(path, options);
    if (
      !result.res.ok &&
      // @ts-expect-error it exists;
      !(!result.body?.message && result.res.status === 403) &&
      !(path.includes('war') && result.res.status === 404)
    ) {
      this.logger.warn(`${result.res.status} ${path}`);
    }
    return result;
  }
}

export class ClashClient extends RESTManager {
  public constructor({
    rateLimit,
    baseURL,
    keys,
  }: {
    rateLimit: number;
    baseURL: string;
    keys: string[];
  }) {
    super();
    this.requestHandler = new ReqHandler({
      cache: false,
      rejectIfNotValid: false,
      restRequestTimeout: 10_000,
      retryLimit: 0,
      connections: 50,
      pipelining: 10,
      baseURL,
      keys,
      throttler: rateLimit ? new QueueThrottler(rateLimit) : null,
    });
  }
}

const ClashClientProvider: Provider = {
  provide: Tokens.CLASH_CLIENT,
  useFactory: (configService: ConfigService): ClashClient => {
    return new ClashClient({
      rateLimit: 0,
      baseURL: configService.getOrThrow('CLASH_API_BASE_URL'),
      keys: configService.getOrThrow<string>('CLASH_API_TOKENS').split(','),
    });
  },
  inject: [ConfigService],
};

@Module({
  imports: [RedisModule],
  providers: [ClashClientService, ClashClientProvider],
  exports: [ClashClientService, ClashClientProvider],
})
export class ClashClientModule {}
