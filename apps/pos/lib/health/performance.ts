import { REQUEST_METRICS_HOUR_MS, type RequestMetricsBucket } from '@tallyui/database';

// Store health › Performance, ported from v2 apps/main/components/health/performance-logic.ts.

export type UptimeCell = { hourStartMs: number; state: 'running' | 'errors' | 'closed'; requests: number; errors: number };

/**
 * Uptime strip cells for the trailing window, newest last (v2 deriveUptimeCells). Buckets exist only when the till
 * made requests, and an open till checks continuously, so a missing hour reads "app closed".
 */
export function deriveUptimeCells(buckets: RequestMetricsBucket[], nowMs: number, hours = 24): UptimeCell[] {
  const byHour = new Map(buckets.map(bucket => [bucket.hourStartMs, bucket]));
  const currentHourStart = Math.floor(nowMs / REQUEST_METRICS_HOUR_MS) * REQUEST_METRICS_HOUR_MS;
  const cells: UptimeCell[] = [];
  for (let i = hours - 1; i >= 0; i -= 1) {
    const hourStartMs = currentHourStart - i * REQUEST_METRICS_HOUR_MS;
    const bucket = byHour.get(hourStartMs);
    const requests = bucket?.requests ?? 0;
    const errors = bucket?.errors ?? 0;
    cells.push({ hourStartMs, state: requests === 0 ? 'closed' : errors > 0 ? 'errors' : 'running', requests, errors });
  }
  return cells;
}

export type PerformanceSummary = { requests: number; megabytes: number; typicalMs: number | null };

/** v2 summarizeLast24h, cut to the status line's three numbers. */
export function summarizeLast24h(buckets: RequestMetricsBucket[], nowMs: number): PerformanceSummary {
  const cutoff = nowMs - 24 * REQUEST_METRICS_HOUR_MS;
  const recent = buckets.filter(bucket => bucket.hourStartMs >= cutoff);
  const requests = recent.reduce((sum, bucket) => sum + bucket.requests, 0);
  const bytes = recent.reduce((sum, bucket) => sum + bucket.bytes, 0);
  const durationTotal = recent.reduce((sum, bucket) => sum + bucket.durationTotalMs, 0);
  const durationCount = recent.reduce((sum, bucket) => sum + bucket.durationCount, 0);
  return { requests, megabytes: bytes / 1_048_576, typicalMs: durationCount > 0 ? Math.round(durationTotal / durationCount) : null };
}

/** The status line's words after "✓ Normal" (v2 health.performance.summary / no_history). */
export function performanceSummary({ requests, megabytes, typicalMs }: PerformanceSummary): string {
  if (requests === 0) return '— no history yet. These numbers fill in as this till runs; the controls below work now.';
  const typical = typicalMs !== null ? ` · typical response ${typicalMs} ms` : '';
  return `— last 24 h: ${requests.toLocaleString()} requests · ${megabytes.toFixed(1)} MB${typical}`;
}

/** A countdown or interval in whole seconds under 90 s, else whole minutes; null when not a positive number (v2 logs-logic formatCadence). */
export function formatCadence(ms: number): { value: number; unit: 's' | 'min' } | null {
  if (!Number.isFinite(ms) || ms <= 0) return null;
  if (ms < 90_000) return { value: Math.max(1, Math.round(ms / 1000)), unit: 's' };
  return { value: Math.max(1, Math.round(ms / 60_000)), unit: 'min' };
}
