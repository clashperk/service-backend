import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Session } from 'node:inspector';
import { ApiKeyGuard } from '../auth';

/**
 * On-demand V8 CPU profiling for a running fork.
 *
 * Profiling normally means restarting with `--cpu-prof`, which loses the very
 * state you want to inspect. This attaches an inspector session to the live
 * process instead, so a fork can be profiled while it is under real load.
 *
 * The request lands on whichever fork the cluster picks; they all do the same
 * work, so any of them is representative. Hit it a few times to be sure.
 *
 *   curl -H 'x-api-key: $API_KEY' \
 *        'http://localhost:8090/debug/cpu-profile?seconds=20' > worker.cpuprofile
 *
 * Load the file into Chrome DevTools (Performance > Load profile).
 */
@Controller('/debug')
@UseGuards(ApiKeyGuard)
@ApiExcludeController()
export class ProfilerController {
  @Get('/cpu-profile')
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename="worker.cpuprofile"')
  public async cpuProfile(@Query('seconds') seconds?: string): Promise<string> {
    // Capped: the profiler adds overhead and holds samples in memory for the
    // whole run, so an unbounded value would be a foot-gun on a busy fork.
    const durationMs = Math.min(Math.max(Number(seconds) || 20, 1), 120) * 1000;

    const session = new Session();
    session.connect();

    const post = <T>(method: string): Promise<T> =>
      new Promise((resolve, reject) => {
        session.post(method, (err, result) => (err ? reject(err) : resolve(result as T)));
      });

    try {
      await post('Profiler.enable');
      await post('Profiler.start');
      await new Promise((resolve) => setTimeout(resolve, durationMs));
      const { profile } = await post<{ profile: unknown }>('Profiler.stop');
      return JSON.stringify(profile);
    } finally {
      // Always detach: a leaked inspector session keeps profiling overhead alive
      // for the lifetime of the process.
      session.disconnect();
    }
  }
}
