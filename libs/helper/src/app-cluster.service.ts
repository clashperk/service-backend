import { Injectable, Logger } from '@nestjs/common';
import cluster from 'node:cluster';
import os from 'node:os';

const numCPUs = os.cpus().length;

/**
 * @example
 * ```ts
 * AppClusterService.clustering(bootstrap);
 * ```
 */
@Injectable()
export class AppClusterService {
  static logger = new Logger(AppClusterService.name);

  static async clustering(callback: () => unknown): Promise<unknown> {
    if (cluster.isPrimary) {
      this.logger.log(`Master server started on ${process.pid}`);
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
        await this.delay(5000);
      }

      cluster.on('exit', (worker, code, signal) => {
        this.logger.log(
          `Worker ${worker.process.pid} died with code ${code} and signal ${signal}.`,
        );
        cluster.fork();
      });
    } else {
      callback();
      this.logger.log(`Cluster server started on ${process.pid}`);
    }

    return {};
  }

  static delay(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}
