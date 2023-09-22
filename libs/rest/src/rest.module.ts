import { Tokens } from '@app/constants';
import { Logger, Module, Provider } from '@nestjs/common';
import {
  QueueThrottler,
  RESTManager,
  RequestHandler,
  RequestOptions,
  Result,
} from 'clashofclans.js';
import { RestService } from './rest.service';

class ReqHandler extends RequestHandler {
  private readonly logger = new Logger('ClashApiRest');

  public async request<T>(path: string, options: RequestOptions = {}): Promise<Result<T>> {
    const result = await super.request<T>(path, options);
    if (
      !result.res.ok &&
      // @ts-expect-error ---
      !(!result.body?.message && result.res.status === 403) &&
      !(path.includes('war') && result.res.status === 404)
    ) {
      this.logger.log(`${result.res.status} ${path}`);
    }
    return result;
  }
}

export default class RestHandler extends RESTManager {
  public constructor(rateLimit: number) {
    super();
    this.requestHandler = new ReqHandler({
      cache: false,
      rejectIfNotValid: false,
      restRequestTimeout: 10_000,
      retryLimit: 0,
      connections: 50,
      pipelining: 10,
      baseURL: process.env.CLASH_API_BASE_URL,
      keys: process.env.CLASH_API_TOKENS?.split(',') ?? [],
      throttler: rateLimit ? new QueueThrottler(rateLimit) : null,
    });
  }
}

const RestProvider: Provider = {
  provide: Tokens.REST,
  useFactory: (): RestHandler => {
    return new RestHandler(0);
  },
};

@Module({
  providers: [RestService, RestProvider],
  exports: [RestService, RestProvider],
})
export class RestModule {}
