import { Global, Module } from '@nestjs/common';
import { OpenTelemetryModule } from 'nestjs-otel';
import { TrackerMetrics } from './metrics.service';

@Global()
@Module({
  imports: [OpenTelemetryModule.forRoot({ metrics: { hostMetrics: false } })],
  providers: [TrackerMetrics],
  exports: [TrackerMetrics, OpenTelemetryModule],
})
export class MetricsModule {}
