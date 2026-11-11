import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '@tallyui/components';
import type { HourBucket } from '../lib/reports/sales-room';

const orders = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`;
const pad = (hour: number) => String(hour).padStart(2, '0');
const clock = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
/** Where a bucket sits on the chart's clock: its start minute on a single day, its index over several days. */
const keyOf = (bucket: HourBucket) => bucket.day ? bucket.hour : bucket.minute;
/** v2 measures its label with the chart font; this estimates text-xs semibold, and the plot clamps it. */
const labelWidth = (text: string) => text.length * 7.5 + 16;

/**
 * v2 reports/chart: the hero's By hour (By day over several days) bars or Running total line, the comparison dashed
 * over them. `nowKey` is where now falls on that clock: a minute of the store day, or a day bucket's index; a bucket that
 * starts after it is the future (v2 chart.tsx `bucket.key > now`). A `live` period (one that runs to now) reads its
 * running total "… now", a closed one the amount alone, and its By hour view draws a future bucket's comparison as a
 * muted bar, as v2 does.
 */
export function HourlyBars({ hours, money, comparisonName = 'yesterday', nowKey, live = true, view }: {
  hours: readonly HourBucket[]; money(minor: number): string; comparisonName?: string; nowKey: number; live?: boolean; view: 'hour' | 'run';
}) {
  const [primary, muted] = useCSSVariable(['--color-primary', '--color-muted-foreground'])
    .map(value => value === undefined ? undefined : String(value));
  const [width, setWidth] = useState(0);
  if (hours.length === 0) return null;
  const n = hours.length;
  const run = view === 'run';
  const future = hours.map(bucket => live && keyOf(bucket) > nowKey);
  let busiest = -1;
  hours.forEach((bucket, i) => {
    // The highest bucket today that is not the future; the earliest wins a tie.
    if (!future[i] && bucket.today.totalMinor > 0 && (busiest < 0 || bucket.today.totalMinor > hours[busiest].today.totalMinor)) busiest = i;
  });
  const compared = hours.some(bucket => bucket.yesterday.totalMinor > 0);
  const runToday: number[] = [];
  const runPrevious: number[] = [];
  hours.forEach((bucket, i) => {
    runToday.push((runToday[i - 1] ?? 0) + bucket.today.totalMinor);
    runPrevious.push((runPrevious[i - 1] ?? 0) + bucket.yesterday.totalMinor);
  });
  // Buckets after now are the future: today's running line stops at the current one.
  const end = hours.filter(bucket => keyOf(bucket) <= nowKey).length - 1;
  const todayEnd = runToday[end] ?? 0;
  const previousEnd = runPrevious[n - 1];
  const max = run ? Math.max(todayEnd, previousEnd) || 1
    : Math.max(0, ...hours.flatMap(bucket => [bucket.today.totalMinor, bucket.yesterday.totalMinor]));
  const pct = (value: number) => max > 0 ? Math.round((100 * value) / max) : 0;
  const height = (value: number) => max > 0 ? (100 * value) / max : 0;
  const points = (values: readonly number[]) => values.map((value, i) => `${i + 0.5},${100 - height(value)}`).join(' ');
  const comparison = run ? runPrevious : hours.map(bucket => bucket.yesterday.totalMinor);
  const todayPoints = points(runToday.slice(0, end + 1));
  const label = (testID: string, index: number, value: number, text: string, className: string, below = false) => {
    const w = labelWidth(text);
    const left = Math.max(0, Math.min(width - w, ((index + 0.5) / n) * width - w / 2));
    const at = height(value);
    return (
      <Text testID={testID} numberOfLines={1} className={`absolute text-center text-xs font-semibold tabular-nums ${className}`}
        style={{ left, width: w, ...(below ? { top: `${100 - at}%`, marginTop: 4 } : { bottom: `${at}%`, marginBottom: 4 }) }}>
        {text}
      </Text>
    );
  };
  const k = Math.ceil(n / 12);
  // Whole-hour steps keep the `sales-hour-HH` ids; 30- and 90-minute steps name the minute too.
  const wholeHours = hours.every(bucket => bucket.minute % 60 === 0);

  return (
    <View testID="sales-room-hours" className="h-48 pt-6" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View className="flex-1 flex-row">
        {hours.map(({ hour, minute, day, today, yesterday }, i) => {
          const id = day ? `sales-day-${day}` : `sales-hour-${wholeHours ? pad(hour) : clock(minute).replace(':', '')}`;
          const name = day ? String(Number(day.slice(8))) : clock(minute);
          return (
            <View
              key={day ?? minute}
              testID={id}
              className="flex-1 items-center justify-end px-0.5"
              accessibilityLabel={`${day ?? name} — ${day ? '' : 'today '}${money(today.totalMinor)}, ${orders(today.count)}; ${comparisonName} ${money(yesterday.totalMinor)}`}
            >
              <View className="w-full max-w-12 flex-1 justify-end">
                {/* v2 chart.tsx: a future bucket's bar is the comparison's value, muted at full opacity. */}
                {!run && future[i] && compared && (
                  <View testID={`${id}-future`} className="rounded-sm bg-muted"
                    style={{ height: `${pct(yesterday.totalMinor)}%`, opacity: 1 }} />
                )}
                {!run && !future[i] && (
                  <View
                    testID={`${id}-today`}
                    className="rounded-sm bg-primary"
                    style={{ height: `${pct(today.totalMinor)}%`, opacity: i === busiest ? 1 : 0.55 }}
                  />
                )}
              </View>
              {/* Every column keeps its label slot, so the bars share one baseline. */}
              <Text numberOfLines={1} className="mt-1 h-4 w-12 text-center text-xs text-muted-foreground">{i % k === 0 ? name : ''}</Text>
            </View>
          );
        })}
      </View>
      <View className="pointer-events-none absolute bottom-5 left-0 right-0 top-6">
        <Svg width="100%" height="100%" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
          {run && end >= 0 && <>
            <Polygon testID="hero-chart-area" points={`0.5,100 ${todayPoints} ${end + 0.5},100`} fill={primary} fillOpacity={0.1} />
            <Polyline testID="hero-chart-run" points={todayPoints} fill="none" stroke={primary} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          </>}
          {compared && (
            <Polyline testID="hero-chart-comparison" points={points(comparison)} fill="none" stroke={muted} strokeWidth={1.5}
              strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          )}
        </Svg>
        {!run && busiest >= 0 && label('hero-chart-peak', busiest, hours[busiest].today.totalMinor,
          `${money(hours[busiest].today.totalMinor)} · ${orders(hours[busiest].today.count)}`, 'text-primary')}
        {run && label('hero-chart-total', Math.max(0, end), todayEnd, live ? `${money(todayEnd)} now` : money(todayEnd), 'text-primary')}
        {run && compared && label('hero-chart-comparison-total', n - 1, previousEnd, money(previousEnd), 'text-muted-foreground', true)}
      </View>
    </View>
  );
}
