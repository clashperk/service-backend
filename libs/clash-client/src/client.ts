import { Injectable, Logger } from '@nestjs/common';
import { QueueThrottler, RESTManager, RequestHandler, Util } from 'clashofclans.js';
import moment from 'moment';

export class Season {
  public static get ID() {
    return this.getSeason().seasonId;
  }

  public static getSeason(inputDate?: Date | string) {
    const currentDate = inputDate ? moment(inputDate).toDate() : new Date();
    if (
      currentDate > new Date('2025-08-25T05:00:00.000Z') &&
      currentDate <= new Date('2025-10-06T05:00:00.000Z')
    ) {
      return {
        seasonId: '2025-09',
        startTime: new Date('2025-08-25T05:00:00.000Z'),
        endTime: new Date('2025-10-06T05:00:00.000Z'),
      };
    }

    if (
      currentDate > new Date('2025-10-06T05:00:00.000Z') &&
      currentDate <= new Date('2025-11-03T05:00:00.000Z')
    ) {
      return {
        seasonId: '2025-10',
        startTime: new Date('2025-10-06T05:00:00.000Z'),
        endTime: new Date('2025-11-03T05:00:00.000Z'),
      };
    }

    if (
      currentDate > new Date('2025-11-03T05:00:00.000Z') &&
      currentDate <= new Date('2025-12-01T05:00:00.000Z')
    ) {
      return {
        seasonId: '2025-11',
        startTime: new Date('2025-11-03T05:00:00.000Z'),
        endTime: new Date('2025-12-01T05:00:00.000Z'),
      };
    }

    const season = Util.getSeason(currentDate);
    return {
      ...season,
      seasonId: moment(season.startTime).format('YYYY-MM'),
    };
  }
}

@Injectable()
export class ClashClient extends RESTManager {
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
      connections: 50,
      pipelining: 10,
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
