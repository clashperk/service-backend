import { Injectable, Logger } from '@nestjs/common';
import { QueueThrottler, RESTManager, RequestHandler, Util } from 'clashofclans.js';
import moment from 'moment';

export class Season {
  public static get ID() {
    if (
      new Date() > new Date('2025-08-25T05:00:00.000Z') &&
      new Date() <= new Date('2025-10-06T05:00:00.000Z')
    ) {
      return '2025-09';
    }

    if (
      new Date() > new Date('2025-10-06T05:00:00.000Z') &&
      new Date() <= new Date('2025-10-27T05:00:00.000Z')
    ) {
      return '2025-10';
    }
    return Util.getSeasonId();
  }

  public static get legendLeagueId() {
    return Util.getSeasonId();
  }

  public static getSeason(inputDate?: Date) {
    const currentDate = inputDate ? moment(inputDate).toDate() : new Date();
    if (
      currentDate > new Date('2025-08-25T05:00:00.000Z') &&
      currentDate <= new Date('2025-10-06T05:00:00.000Z')
    ) {
      return {
        startTime: new Date('2025-08-25T05:00:00.000Z'),
        endTime: new Date('2025-10-06T04:59:59.999Z'),
      };
    }

    if (
      currentDate > new Date('2025-10-06T05:00:00.000Z') &&
      currentDate <= new Date('2025-10-27T05:00:00.000Z')
    ) {
      return {
        startTime: new Date('2025-10-06T05:00:00.000Z'),
        endTime: new Date('2025-10-27T04:59:59.999Z'),
      };
    }

    return Util.getSeason(currentDate);
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
