import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { RequestMetrics, RequestMetricsBucket } from '@tallyui/database';
import { deriveUptimeCells, performanceSummary, summarizeLast24h, trendPoints } from '../lib/health/performance';
import { DocsLink } from './docs-link';
import { TrendLine } from './trend-line';
import { UptimeStrip } from './uptime-strip';

// v2 apps/main/components/health/performance-screen.tsx:38 (DOCS_URL).
const PERFORMANCE_DOCS_URL = 'https://docs.wcpos.com/support/store-health#performance';

/** Load averages read best with a consistent decimal; counts use locale formatting (v2 performance-screen.tsx:40-46). */
const formatLoad = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: value >= 10 ? 1 : 2 });
const formatCount = (value: number) => value.toLocaleString();

/** v2 packages/components/src/section: a line-separated Store health section, hairline on top unless first. */
export function HealthSection({ title, sub, first = false, testID, children }: {
  title: string; sub?: string; first?: boolean; testID?: string; children: ReactNode;
}) {
  return (
    <View testID={testID} className={first ? 'gap-3' : 'gap-3 border-t border-border pt-4'}>
      <View className="gap-0.5">
        <Text className="text-base font-semibold">{title}</Text>
        {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Store health › Performance (v2 apps/main/components/health/performance-screen.tsx): the status line, Engine uptime,
 * the sync controls the route passes in, and Your server, over time.
 */
export function PerformanceScreen({ metrics, healthy, now = Date.now, children }: {
  metrics: RequestMetrics; healthy: boolean; now?: () => number; children?: ReactNode;
}) {
  const [buckets, setBuckets] = useState<RequestMetricsBucket[]>(() => metrics.buckets());
  const [nowMs, setNowMs] = useState(now);
  useEffect(() => {
    // The clock rides the buckets, and a slow tick keeps the strip's hours current while nothing is recorded (v2 :78-88).
    const subscription = metrics.buckets$.subscribe(next => { setBuckets(next); setNowMs(now()); });
    const interval = setInterval(() => setNowMs(now()), 10_000);
    return () => { subscription.unsubscribe(); clearInterval(interval); };
  }, [metrics, now]);
  const summary = summarizeLast24h(buckets, nowMs);
  const { requestPoints, loadPoints } = trendPoints(buckets, nowMs);
  // Only a server we have talked to can be said to not report its load (v2 :94-97).
  const loadUnavailable = summary.requests > 0 && loadPoints.length === 0;
  // The area layout (app/health/_layout.tsx) draws the card, the page title and the scroll.
  return (
    <View testID="screen-health-performance" className="gap-6">
      <View className="flex-row flex-wrap items-baseline gap-2">
        <Text testID="performance-status" className={healthy ? 'font-semibold text-success' : 'font-semibold text-warning-text'}>
          {healthy ? '✓ Normal' : '⚠ Needs attention'}
        </Text>
        <Text testID="performance-summary" className="text-sm text-muted-foreground">
          {performanceSummary(summary)}
        </Text>
      </View>
      <HealthSection first testID="uptime-section" title="Engine uptime"
        sub="Each cell is one hour of this till's sync activity. An empty cell means the app was closed.">
        <UptimeStrip cells={deriveUptimeCells(buckets, nowMs)} />
      </HealthSection>
      {children}
      {/* v2 performance-screen.tsx:346-408; the pace line v2 draws from engine pressure is not drawn: TallyUI exposes no pressure. */}
      <HealthSection testID="server-over-time-section" title="Your server, over time"
        sub="Server load is everything running on your server — not just the POS.">
        <View className="gap-5">
          {loadUnavailable ? (
            <Text testID="performance-trend-load-unavailable" className="text-sm text-muted-foreground">
              Your server doesn't report its load. Everything else on this page still works.
            </Text>
          ) : (
            <TrendLine testID="performance-trend-load" label="Server load" points={loadPoints} tone="neutral" formatValue={formatLoad} />
          )}
          <TrendLine testID="performance-trend-requests" label="POS requests" points={requestPoints} tone="accent" formatValue={formatCount} />
        </View>
      </HealthSection>
      {/* v2 performance-screen.tsx:410-413: one link out — everything deeper lives in the docs. */}
      <DocsLink testID="performance-docs-link" href={PERFORMANCE_DOCS_URL}>Learn more in the docs</DocsLink>
    </View>
  );
}
