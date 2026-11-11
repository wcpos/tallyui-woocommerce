import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '@tallyui/components';
import type { HourBucket } from '../lib/reports/sales-room';

const orders = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`;
const pad = (hour: number) => String(hour).padStart(2, '0');
/** v2 measures its label with the chart font; this estimates text-xs semibold, and the plot clamps it. */
const labelWidth = (text: string) => text.length * 7.5 + 16;

/** v2 reports/chart: the hero's By hour bars or Running total line, with the comparison day dashed over them. */
export function HourlyBars({ hours, money, comparisonName = 'yesterday', nowHour, view }: {
  hours: readonly HourBucket[]; money(minor: number): string; comparisonName?: string; nowHour: number; view: 'hour' | 'run';
}) {
  const [primary, muted] = useCSSVariable(['--color-primary', '--color-muted-foreground'])
    .map(value => value === undefined ? undefined : String(value));
  const [width, setWidth] = useState(0);
  if (hours.length === 0) return null;
  const n = hours.length;
  const run = view === 'run';
  let busiest = -1;
  hours.forEach((bucket, i) => {
    // The highest hour today; the earliest wins a tie.
    if (bucket.today.totalMinor > 0 && (busiest < 0 || bucket.today.totalMinor > hours[busiest].today.totalMinor)) busiest = i;
  });
  const compared = hours.some(bucket => bucket.yesterday.totalMinor > 0);
  const runToday: number[] = [];
  const runPrevious: number[] = [];
  hours.forEach((bucket, i) => {
    runToday.push((runToday[i - 1] ?? 0) + bucket.today.totalMinor);
    runPrevious.push((runPrevious[i - 1] ?? 0) + bucket.yesterday.totalMinor);
  });
  // Hours after now are the future: today's running line stops at the current hour.
  const end = hours.filter(bucket => bucket.hour <= nowHour).length - 1;
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

  return (
    <View testID="sales-room-hours" className="h-48 pt-6" onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <View className="flex-1 flex-row">
        {hours.map(({ hour, today, yesterday }, i) => {
          const HH = pad(hour);
          return (
            <View
              key={hour}
              testID={`sales-hour-${HH}`}
              className="flex-1 items-center justify-end px-0.5"
              accessibilityLabel={`${HH}:00 — today ${money(today.totalMinor)}, ${orders(today.count)}; ${comparisonName} ${money(yesterday.totalMinor)}`}
            >
              <View className="w-full max-w-12 flex-1 justify-end">
                {!run && (
                  <View
                    testID={`sales-hour-${HH}-today`}
                    className="rounded-sm bg-primary"
                    style={{ height: `${pct(today.totalMinor)}%`, opacity: i === busiest ? 1 : 0.55 }}
                  />
                )}
              </View>
              {/* Every column keeps its label slot, so the bars share one baseline. */}
              <Text numberOfLines={1} className="mt-1 h-4 w-12 text-center text-xs text-muted-foreground">{i % k === 0 ? `${HH}:00` : ''}</Text>
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
        {run && label('hero-chart-total', Math.max(0, end), todayEnd, `${money(todayEnd)} now`, 'text-primary')}
        {run && compared && label('hero-chart-comparison-total', n - 1, previousEnd, money(previousEnd), 'text-muted-foreground', true)}
      </View>
    </View>
  );
}
