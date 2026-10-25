import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,
  serverName: 'clashperk_backend',
  environment: process.env.NODE_ENV || 'development',

  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profileSessionSampleRate: 1.0,
  profileLifecycle: 'trace',

  // Only request traces are kept; a dropped root span drops its children with it.
  ignoreSpans: [{ op: /^(?!http\.server)/ }],
});
