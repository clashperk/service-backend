import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: !!process.env.SENTRY_DSN,

  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,

  ignoreSpans: [{ op: /^(?!http\.server)/ }],

  beforeSendTransaction(event) {
    if (event.contexts?.trace?.op === 'http.server') {
      return event;
    }
    return null;
  },

  enableLogs: true,
});
