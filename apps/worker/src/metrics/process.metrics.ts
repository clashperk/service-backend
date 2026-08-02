import { Injectable, OnModuleInit } from '@nestjs/common';
import { metrics } from '@opentelemetry/api';

/**
 * Per-fork process memory.
 *
 * The runtime instrumentation only reports the V8 heap, which is a fraction of what
 * the container is actually charged for. During a crash loop on 2026-08-02 the heap
 * sat flat at ~450MB across all four forks while the container was being OOM-killed
 * every few minutes — the memory that mattered was `external` and `arrayBuffers`
 * (undici socket buffers, gzip output, `Buffer` allocations), none of which the heap
 * gauges can see. RSS is the number to alert on, since that is what Docker kills for.
 */
@Injectable()
export class ProcessMetrics implements OnModuleInit {
  public onModuleInit() {
    const meter = metrics.getMeter('worker-process');

    const rss = meter.createObservableGauge('process.memory.rss', {
      description: 'Resident set size — the figure the container memory limit applies to',
      unit: 'By',
    });
    const heapUsed = meter.createObservableGauge('process.memory.heap_used', {
      description: 'V8 heap in use',
      unit: 'By',
    });
    const heapTotal = meter.createObservableGauge('process.memory.heap_total', {
      description: 'V8 heap reserved',
      unit: 'By',
    });
    const external = meter.createObservableGauge('process.memory.external', {
      description:
        'Memory held by C++ objects bound to JS — off-heap, and invisible to heap gauges',
      unit: 'By',
    });
    const arrayBuffers = meter.createObservableGauge('process.memory.array_buffers', {
      description:
        'Memory in ArrayBuffers and Buffers, the bulk of socket and compression allocation',
      unit: 'By',
    });

    // One callback for all five so memoryUsage() is sampled once per collection
    // rather than five times.
    meter.addBatchObservableCallback(
      (observer) => {
        const usage = process.memoryUsage();
        observer.observe(rss, usage.rss);
        observer.observe(heapUsed, usage.heapUsed);
        observer.observe(heapTotal, usage.heapTotal);
        observer.observe(external, usage.external);
        observer.observe(arrayBuffers, usage.arrayBuffers);
      },
      [rss, heapUsed, heapTotal, external, arrayBuffers],
    );
  }
}
