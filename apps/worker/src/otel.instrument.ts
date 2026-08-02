/**
 * MUST be the first import in `main.ts`. OpenTelemetry patches libraries as they
 * are `require`d, so anything loaded before this file runs stays uninstrumented
 * — that is exactly why `Sentry.init` moved out of `worker.module.ts`.
 */
import 'dotenv/config';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import * as Sentry from '@sentry/node';
import cluster from 'node:cluster';

/**
 * Sentry v10 registers its own OpenTelemetry tracer provider during `init()`
 * unless told not to. Ours has to be the only one — error reporting, breadcrumbs
 * and profiling are unaffected by opting out of its tracing setup.
 */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    serverName: 'clashperk_tracking_service',
    environment: process.env.NODE_ENV ?? 'development',
    integrations: [Sentry.httpIntegration({ breadcrumbs: false })],
    skipOpenTelemetrySetup: true,
  });
}

const OTLP_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://otel-collector:4318';

/**
 * Collapses a request path to a low-cardinality shape suitable for a metric label:
 * `/v1/players/%232PP` -> `players/{tag}`, `/v1/locations/32000006/rankings/clans`
 * -> `locations/{id}/rankings/clans`.
 */
function endpointShape(path: string): string {
  const [withoutQuery] = path.split('?');
  const shape = withoutQuery
    .split('/')
    .filter((segment) => segment && segment !== 'v1')
    .map((segment) => {
      if (segment.startsWith('%23') || segment.startsWith('#')) return '{tag}';
      return /^\d+$/.test(segment) ? '{id}' : segment;
    })
    .join('/');
  return shape || '/';
}

/**
 * Every fork needs a distinct `service.instance.id`: the collector's Prometheus
 * exporter maps it to the `instance` label, which is what keeps four forks
 * emitting the same counter from colliding into one contested series.
 */
const resource = defaultResource().merge(
  resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'clashperk-worker',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    'service.instance.id': `fork-${cluster.worker?.id ?? 0}`,
  }),
);

export const otelSDK = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({ url: `${OTLP_ENDPOINT}/v1/traces` }),
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${OTLP_ENDPOINT}/v1/metrics` }),
      exportIntervalMillis: 15_000,
    }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      // Every readFile would otherwise become a span — enormous volume, no value.
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-undici': {
        // All outbound HTTP shares one span name ("GET"), so per-endpoint latency is
        // invisible. url.full cannot be used as a metric dimension — one label value
        // per player tag — so collapse the path to its shape instead: a bounded set
        // like "players/{tag}" or "clans/{tag}/currentwar".
        requestHook: (span, request) => {
          try {
            span.setAttribute('coc.endpoint', endpointShape(String(request.path)));
          } catch {
            // Instrumentation must never break the request it is measuring.
          }
        },
      },
      // Per-process event loop lag and GC, which is how we tell "the API is slow"
      // apart from "the fork is CPU-starved".
      '@opentelemetry/instrumentation-runtime-node': { enabled: true },
    }),
  ],
});

/**
 * The primary only forks and supervises; starting an exporter there would ship
 * an idle, permanently-empty instance to the collector.
 */
if (!cluster.isPrimary) {
  otelSDK.start();

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void otelSDK.shutdown().finally(() => process.exit(0));
    });
  }
}
