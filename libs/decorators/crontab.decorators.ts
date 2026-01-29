import { Config } from '@app/constants';
import { applyDecorators } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SentryCron } from '@sentry/nestjs';

export function CronTab(cronTime: string, options: { monitor: string }): MethodDecorator {
  return applyDecorators(
    Cron(cronTime, {
      timeZone: 'Etc/UTC',
      disabled: !Config.CRON_ENABLED && Config.IS_PROD,
    }),
    SentryCron(options.monitor, {
      schedule: {
        type: 'crontab',
        value: cronTime,
      },
      timezone: 'Etc/UTC',
    }),
  );
}
