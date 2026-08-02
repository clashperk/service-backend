import { Injectable } from '@nestjs/common';
import type { Counter, Gauge } from '@opentelemetry/api';
import { MetricService } from 'nestjs-otel';

/**
 * Domain counters that no span can express — how many players we got through
 * and how fast. Method *durations* are not here: `@Traceable()` emits those as
 * spans, and the collector's spanmetrics connector turns them into histograms.
 */
@Injectable()
export class TrackerMetrics {
  private readonly playersFetched: Counter;
  private readonly loopDuration: Gauge;
  private readonly loopThroughput: Gauge;
  private readonly cachedClans: Gauge;

  constructor(private readonly metricService: MetricService) {
    this.playersFetched = this.metricService.getCounter('tracker.players.fetched', {
      description: 'Player API fetches, by outcome (rate() this for players/sec)',
    });

    this.loopDuration = this.metricService.getGauge('tracker.loop.duration', {
      description: 'Duration of the most recently completed tracking loop',
      unit: 's',
    });

    this.loopThroughput = this.metricService.getGauge('tracker.loop.players_per_second', {
      description: 'Players fetched per second during the most recently completed loop',
    });

    this.cachedClans = this.metricService.getGauge('tracker.cached_clans', {
      description: 'Clans currently in a tracking loop rotation',
    });
  }

  public playerFetched(status: 'ok' | 'not_found' | 'error') {
    this.playersFetched.add(1, { status });
  }

  public clansCached(loop: string, count: number) {
    this.cachedClans.record(count, { loop });
  }

  public loopCompleted(loop: string, timeTakenMs: number, players: number) {
    const seconds = timeTakenMs / 1000;
    this.loopDuration.record(seconds, { loop });
    this.loopThroughput.record(seconds > 0 ? players / seconds : 0, { loop });
  }
}
