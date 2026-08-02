import { Global, Module } from '@nestjs/common';
import { OpenTelemetryModule } from 'nestjs-otel';
import { TrackerMetrics } from './metrics.service';
import { ProcessMetrics } from './process.metrics';

@Global()
@Module({
  imports: [OpenTelemetryModule.forRoot({ metrics: { hostMetrics: false } })],
  providers: [TrackerMetrics, ProcessMetrics],
  exports: [TrackerMetrics, ProcessMetrics, OpenTelemetryModule],
})
export class MetricsModule {}
