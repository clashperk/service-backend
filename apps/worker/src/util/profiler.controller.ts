import { ClashClientService } from '@app/clash-client';
import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import cluster from 'node:cluster';
import diagnosticsChannel from 'node:diagnostics_channel';
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

  /**
   * Splits a fetch into phases, from inside a loaded fork, using undici's
   * diagnostics channels.
   *
   * Five explanations for the fork's 225ms have now been measured and killed:
   * the network (1.2ms RTT), the API itself (a fresh process in this same
   * container, at this same moment, fetches the same tags in 22ms), the undici
   * pool config (production and the fresh process both run
   * `connections: null, pipelining: 1`), the library throttler (`rateLimit: 0`,
   * so it is null), and event-loop blocking (a CPU profile puts expected
   * queueing at ~5.7ms per turn, ~29ms for a whole fetch).
   *
   * So this stops inferring and reads the clock at each phase boundary:
   *
   *   queueMs  create -> sendHeaders   dispatch: pool queueing, DNS, TCP, TLS
   *   ttfbMs   sendHeaders -> headers  the API's own think time plus one RTT
   *   bodyMs   headers -> trailers     response download, multi-chunk reads
   *   tailMs   trailers -> resolved    JSON.parse and our own JS
   *
   * Whichever phase holds the missing ~200ms names the culprit. `connections`
   * also counts sockets opened during the run: if it approaches the request
   * count, sockets are churning and every fetch is paying DNS + a TLS handshake
   * on libuv's 4-thread pool, which is invisible to both the event-loop
   * utilization number and the CPU profile because it happens off-thread.
   *
   *   curl -H 'x-api-key: $API_KEY' 'http://localhost:8090/debug/fetch-phases?n=25'
   */
  @Get('/fetch-phases')
  public async fetchPhases(@Query('n') n?: string): Promise<unknown> {
    const count = Math.min(Math.max(Number(n) || 25, 1), 100);
    const client = this.clashClientService.getClient();

    const ranking = await client.getClanRanks('global', { limit: 5 });
    const clanTag = ranking.body?.items?.[0]?.tag;
    if (!clanTag) return { error: 'could not resolve a clan to sample from' };

    const members = await client.getClanMembers(clanTag, { limit: count });
    const tags = (members.body?.items ?? []).map((m) => m.tag).slice(0, count);
    if (!tags.length) return { error: 'no member tags resolved' };

    // The channels are global, so the tracker's own concurrent traffic shows up
    // here too. Fetches below are sequential and the path carries the tag, so
    // matching on path attributes each event to the request under measurement.
    let current: { path: string; marks: Record<string, number> } | null = null;
    const mark = (path: unknown, phase: string): void => {
      if (!current || path !== current.path) return;
      current.marks[phase] ??= performance.now();
    };

    let connects = 0;
    const subs: { channel: string; fn: (msg: any) => void }[] = [
      { channel: 'undici:request:create', fn: (m) => mark(m.request?.path, 'create') },
      { channel: 'undici:client:sendHeaders', fn: (m) => mark(m.request?.path, 'sendHeaders') },
      { channel: 'undici:request:headers', fn: (m) => mark(m.request?.path, 'headers') },
      { channel: 'undici:request:trailers', fn: (m) => mark(m.request?.path, 'trailers') },
      // Not path-scoped: any socket opened during the run signals churn.
      { channel: 'undici:client:connected', fn: () => void connects++ },
    ];
    for (const s of subs) diagnosticsChannel.subscribe(s.channel, s.fn);

    const rows: { queue: number; ttfb: number; body: number; tail: number; total: number }[] = [];
    const eluBefore = performance.eventLoopUtilization();
    const startedAll = performance.now();

    try {
      for (const tag of tags) {
        current = { path: `/v1/players/${encodeURIComponent(tag)}`, marks: {} };

        const t0 = performance.now();
        await client.getPlayer(tag);
        const t1 = performance.now();

        const m = current.marks;
        // A phase is only meaningful if both of its boundaries were observed;
        // -1 marks "not captured" so it cannot masquerade as a fast phase.
        const span = (a?: number, b?: number): number => (a != null && b != null ? b - a : -1);
        rows.push({
          queue: span(m.create ?? t0, m.sendHeaders),
          ttfb: span(m.sendHeaders, m.headers),
          body: span(m.headers, m.trailers ?? t1),
          tail: span(m.trailers ?? m.headers, t1),
          total: t1 - t0,
        });
      }
    } finally {
      current = null;
      for (const s of subs) diagnosticsChannel.unsubscribe(s.channel, s.fn);
    }

    const elu = performance.eventLoopUtilization(eluBefore);
    const med = (pick: (r: (typeof rows)[number]) => number): number => {
      const xs = rows
        .map(pick)
        .filter((v) => v >= 0)
        .sort((a, b) => a - b);
      return xs.length ? Math.round(xs[Math.floor(xs.length / 2)]) : -1;
    };

    return {
      fork: cluster.worker?.id ?? 'primary',
      pid: process.pid,
      samples: rows.length,
      wallMs: Math.round(performance.now() - startedAll),
      median: {
        // dispatch: pool queueing + DNS + TCP + TLS
        queueMs: med((r) => r.queue),
        // the API's think time plus one RTT
        ttfbMs: med((r) => r.ttfb),
        // response download across however many chunks
        bodyMs: med((r) => r.body),
        // JSON.parse and our own JS
        tailMs: med((r) => r.tail),
        totalMs: med((r) => r.total),
      },
      // Approaching `samples` means sockets are churning and every fetch pays a
      // fresh DNS + TLS handshake on libuv's threadpool.
      connectionsOpened: connects,
      eventLoopUtilization: Number(elu.utilization.toFixed(3)),
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
