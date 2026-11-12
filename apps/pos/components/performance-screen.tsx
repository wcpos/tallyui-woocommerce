import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { RequestMetrics, RequestMetricsBucket } from '@tallyui/database';
import { deriveUptimeCells, performanceSummary, summarizeLast24h } from '../lib/health/performance';
import { UptimeStrip } from './uptime-strip';

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

/** Store health › Performance (v2 apps/main/components/health/performance-screen.tsx): the status line and Engine uptime. */
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
  // The area layout (app/health/_layout.tsx) draws the card, the page title and the scroll.
  return (
    <View testID="screen-health-performance" className="gap-6">
      <View className="flex-row flex-wrap items-baseline gap-2">
        <Text testID="performance-status" className={healthy ? 'font-semibold text-success' : 'font-semibold text-warning'}>
          {healthy ? '✓ Normal' : '⚠ Needs attention'}
        </Text>
        <Text testID="performance-summary" className="text-sm text-muted-foreground">
          {performanceSummary(summarizeLast24h(buckets, nowMs))}
        </Text>
      </View>
      <HealthSection first testID="uptime-section" title="Engine uptime"
        sub="Each cell is one hour of this till's sync activity. An empty cell means the app was closed.">
        <UptimeStrip cells={deriveUptimeCells(buckets, nowMs)} />
      </HealthSection>
      {children}
    </View>
  );
}
