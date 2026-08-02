import { Injectable, Logger } from '@nestjs/common';
import { QueueThrottler, RequestHandler, RestManager, Util } from 'clashofclans.js';

export class Season extends Util {
  public static get ID() {
    return this.getSeason().seasonId;
  }

  public static get ending() {
    const startTimestamp = this.getSeason().startTime.getTime();
    return new Date(startTimestamp + 60 * 60 * 1000).getTime() > Date.now();
  }

  public static get monthId() {
    return new Date().toISOString().substring(0, 7);
  }

  public static get tournamentID() {
    const { id } = Util.getTournamentWindow();
    return id;
  }
}

@Injectable()
export class ClashClient extends RestManager {
  private logger = new Logger(ClashClient.name);
  public constructor({
    rateLimit,
    baseURL,
    keys,
  }: {
    rateLimit: number;
    baseURL?: string;
    keys: string[];
  }) {
    super();
    this.requestHandler = new RequestHandler({
      cache: false,
      rejectIfNotValid: false,
      restRequestTimeout: 10_000,
      retryLimit: 0,
      baseURL,
      keys,
      throttler: rateLimit ? new QueueThrottler(rateLimit) : null,
      onError: ({ path, status, body }) => {
        if (
          (status !== 200 || !body) &&
          !(!(body as Record<string, string>)?.message && status === 403) &&
          !(path.includes('war') && status === 404)
        ) {
          this.logger.debug(`${status} ${path}`);
        }
      },
    });
  }
}
