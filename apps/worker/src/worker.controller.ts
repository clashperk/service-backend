import { RedisKeys } from '@app/constants';
import { formatDuration } from '@app/helpers';
import { Controller, Get, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import camelCase from 'lodash/camelCase';
import { REDIS_TOKEN } from './db';
import { LoopMetrics } from './util/dto';
import { WorkerService } from './worker.service';

@Controller('/')
export class AppController {
  constructor(
    @Inject(REDIS_TOKEN) private redis: Redis,
    private workerService: WorkerService,
  ) {}

  @Get('/')
  getHello(): string {
    return 'Hello World!';
  }

  @Get('/health')
  getHealth() {
    return { message: 'Ok' };
  }

  @Get('/metrics')
  async metrics() {
    const result = await this.redis.hgetall(RedisKeys.LOOP_TIMINGS);

    const metrics = Object.entries(result).reduce<Record<string, LoopMetrics>>(
      (record, [key, value]) => {
        if (!Object.values(RedisKeys).includes(key as RedisKeys)) return record;

        const payload = JSON.parse(value) as { timeTaken: number; timestamp: number };
        record[camelCase(key)] = {
          timeTaken: formatDuration(payload.timeTaken),
          updated: `${formatDuration(Date.now() - new Date(payload.timestamp).getTime())} ago`,
          updatedAt: new Date(payload.timestamp),
        };

        return record;
      },
      {},
    );

    return {
      isInMaintenance: this.workerService.isInMaintenance,
      memoryUsage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
      ...metrics,
    };
  }
}
