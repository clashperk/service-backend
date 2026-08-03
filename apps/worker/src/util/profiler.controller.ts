import { ClashClientService } from '@app/clash-client';
import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import cluster from 'node:cluster';
import { Session } from 'node:inspector';
import { performance } from 'node:perf_hooks';
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
  public constructor(private readonly clashClientService: ClashClientService) {}

  /**
   * Times cold player fetches from INSIDE a loaded tracker fork.
   *
   * This exists to settle one comparison. A throwaway process in the same
   * container, on the same CPU, at the same moment, fetches a cold player in
   * ~63ms — while the worker's own instrumentation reports 200-270ms for the
   * identical call. Every external explanation has been ruled out (network 1.2ms,
   * curl 26-65ms, undici matches curl, the library adds nothing, JSON parse ~1ms,
   * fork 60% idle in a CPU profile).
   *
   * The only untested variable left is the process doing the fetching. This runs
   * the fetch here, in a fork that is busy tracking, with a fresh pool so the pool
   * is held constant against the throwaway-process measurement.
   *
   *   ~63ms  -> the fork is fine; the tracker's own request path is implicated
   *   ~220ms -> a loaded fork inflates its own measurements (event-loop delay on
   *             multi-chunk body reads), and the fix is to smooth the bursts
   *
   *   curl -H 'x-api-key: $API_KEY' 'http://localhost:8090/debug/fetch-latency?n=25'
   */
  @Get('/fetch-latency')
  public async fetchLatency(@Query('n') n?: string): Promise<unknown> {
    const count = Math.min(Math.max(Number(n) || 25, 1), 100);
    const client = this.clashClientService.getClient();

    // Distinct tags, so every fetch is a genuine cache miss like the tracker's.
    const ranking = await client.getClanRanks('global', { limit: 5 });
    const clanTag = ranking.body?.items?.[0]?.tag;
    if (!clanTag) return { error: 'could not resolve a clan to sample from' };

    const members = await client.getClanMembers(clanTag, { limit: count });
    const tags = (members.body?.items ?? []).map((m) => m.tag).slice(0, count);
    if (!tags.length) return { error: 'no member tags resolved' };

    // eventLoopUtilization is only meaningful as a delta across the measurement.
    const eluBefore = performance.eventLoopUtilization();
    const durations: number[] = [];

    for (const tag of tags) {
      const started = performance.now();
      await client.getPlayer(tag);
      durations.push(performance.now() - started);
    }

    const elu = performance.eventLoopUtilization(eluBefore);
    const sorted = [...durations].sort((a, b) => a - b);
    const at = (p: number): number =>
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

    return {
      fork: cluster.worker?.id ?? 'primary',
      pid: process.pid,
      samples: sorted.length,
      // Sequential, so this is the per-request cost with no self-inflicted queueing.
      medianMs: Math.round(at(0.5)),
      p90Ms: Math.round(at(0.9)),
      minMs: Math.round(sorted[0]),
      maxMs: Math.round(sorted[sorted.length - 1]),
      meanMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
      // How busy this fork was while measuring: 1.0 means the loop never idled.
      eventLoopUtilization: Number(elu.utilization.toFixed(3)),
      reference: {
        throwawayProcessSameContainer: '63ms',
        curlOnHost: '65ms',
        workerReportedP50: '200-270ms',
      },
    };
  }

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
