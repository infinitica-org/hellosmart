import { metrics, trace, context, type Meter, type Counter, type Histogram } from '@opentelemetry/api';

let meter: Meter | null = null;
let requestCounter: Counter | null = null;
let requestDuration: Histogram | null = null;
let errorCounter: Counter | null = null;
let sdkStarted = false;
let poolObserved = false;

export function isTelemetryEnabled(): boolean {
  return Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
}

export async function startTelemetry(serviceName: string): Promise<void> {
  if (!isTelemetryEnabled() || sdkStarted) {
    return;
  }
  sdkStarted = true;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT!;
  const tracesUrl = `${endpoint.replace(/\/$/, '')}/v1/traces`;
  const metricsUrl = `${endpoint.replace(/\/$/, '')}/v1/metrics`;

  const [
    { NodeSDK },
    { Resource },
    { PeriodicExportingMetricReader },
    { OTLPTraceExporter },
    { OTLPMetricExporter },
    { HttpInstrumentation },
    { PgInstrumentation },
  ] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/resources'),
    import('@opentelemetry/sdk-metrics'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/exporter-metrics-otlp-http'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-pg'),
  ]);

  const resource = new Resource({
    'service.name': serviceName,
    'deployment.environment': process.env.NODE_ENV ?? 'development',
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: new OTLPTraceExporter({ url: tracesUrl }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: metricsUrl }),
      exportIntervalMillis: 15_000,
    }),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => (req.url ?? '').includes('/health'),
      }),
      new PgInstrumentation(),
    ],
  });

  await sdk.start();
  meter = metrics.getMeter(serviceName);
  requestCounter = meter.createCounter('hs.http.requests', { description: 'HTTP requests' });
  requestDuration = meter.createHistogram('hs.http.duration', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  });
  errorCounter = meter.createCounter('hs.http.errors', { description: 'HTTP 5xx responses' });
}

export function recordHttpMetrics(route: string, method: string, statusCode: number, durationMs: number): void {
  const attrs = { route, method, status_code: String(statusCode) };
  requestCounter?.add(1, attrs);
  requestDuration?.record(durationMs, attrs);
  if (statusCode >= 500) {
    errorCounter?.add(1, attrs);
  }
}

export function currentTraceFields(): { trace_id?: string; span_id?: string } {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }
  const spanContext = span.spanContext();
  if (!spanContext.traceId || spanContext.traceId === '00000000000000000000000000000000') {
    return {};
  }
  return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
}

export function observePgPool(
  pool: { totalCount: number; idleCount: number; waitingCount: number },
  serviceName: string,
): void {
  if (poolObserved) {
    return;
  }
  poolObserved = true;
  if (!meter) {
    meter = metrics.getMeter(serviceName);
  }
  const total = meter.createObservableGauge('hs.pg.pool.total');
  const idle = meter.createObservableGauge('hs.pg.pool.idle');
  const waiting = meter.createObservableGauge('hs.pg.pool.waiting');
  meter.addBatchObservableCallback(
    (obs) => {
      obs.observe(total, pool.totalCount);
      obs.observe(idle, pool.idleCount);
      obs.observe(waiting, pool.waitingCount);
    },
    [total, idle, waiting],
  );
}
