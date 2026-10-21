import { Injectable, Logger } from '@nestjs/common';
import { QueueThrottler, RequestHandler, RestManager, Util } from 'clashofclans.js';
import { getInflightLimiter } from './inflight-limiter';

export class Season extends Util {
  /** Id for everything keyed by the 28-day league season: the season's start date. */
  public static get leagueId() {
    return this.getLeagueSeason().id;
  }

  /** The start-date id for a league season id; callers may still send a legacy YYYY-MM id. */
  public static toLeagueId(id: string) {
    return /^\d{4}-\d{2}$/.test(id) ? this.getLeagueSeasonById(id).id : id;
  }

  /** Id for Players.seasons activity counts: the UTC calendar month. */
  public static get activityId() {
    return this.monthId;
  }

  public static get ending() {
    const startTimestamp = this.getLeagueSeason().startTime.getTime();
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

    // Every instance in the fork funnels through one shared semaphore; see
    // inflight-limiter.ts for why depth, not rate, is what needs bounding.
    const limiter = getInflightLimiter();
    if (limiter) {
      const handler = this.requestHandler;
      const request: typeof handler.request = handler.request.bind(handler);
      const rawRequest: typeof handler.rawRequest = handler.rawRequest.bind(handler);
      handler.request = (path, options) => limiter.run(() => request(path, options));
      handler.rawRequest = (path, options) => limiter.run(() => rawRequest(path, options));
    }
  }
}
