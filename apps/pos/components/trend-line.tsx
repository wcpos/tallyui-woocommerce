import { StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '@tallyui/components';
import { MIN_TREND_POINTS, type TrendPoint } from '../lib/health/performance';

const coordinate = (value: number) => String(Number(value.toFixed(2)));
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * A Store health trend (v2 health/trend-frame.tsx + trend-line-chart.tsx): a label and latest-value header over a
 * fixed-height plot, drawn from the first render. Under two samples the plot says "not enough data yet" instead of a
 * line; otherwise a 2px line over a faint area wash on a zero-based scale, the latest point marked. v2's axes and its
 * pointer readout are not ported.
 */
export function TrendLine({ testID, label, points, tone, formatValue }: {
  testID: string; label: string; points: TrendPoint[]; tone: 'accent' | 'neutral'; formatValue(value: number): string;
}) {
  const [primary, muted] = useCSSVariable(['--color-primary', '--color-muted-foreground'])
    .map(value => value === undefined ? undefined : String(value));
  const color = tone === 'accent' ? primary : muted;
  const first = points[0];
  const last = points.at(-1);
  const max = Math.max(0, ...points.map(point => point.y)) || 1;
  const span = first && last ? last.x - first.x || 1 : 1;
  const xy = points.map(point => [
    coordinate((100 * (point.x - (first?.x ?? 0))) / span), coordinate(100 - (90 * point.y) / max),
  ] as const);
  const line = xy.map(([x, y]) => `${x},${y}`).join(' ');
  const [xLast, yLast] = xy.at(-1) ?? ['0', '0'];
  return (
    <View testID={testID} className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text testID={`${testID}-label`} className="text-base">{label}</Text>
        <View className="flex-row items-baseline gap-1.5">
          <Text testID={`${testID}-time`} className="text-xs text-muted-foreground tabular-nums">{last ? clock(last.x) : ''}</Text>
          <Text testID={`${testID}-latest`} className="text-sm font-semibold tabular-nums">{last ? formatValue(last.y) : '—'}</Text>
        </View>
      </View>
      <View className="h-40">
        {points.length < MIN_TREND_POINTS ? (
          <View className="flex-1 items-center justify-center rounded-md bg-muted/30">
            <Text testID={`${testID}-waiting`} className="text-xs text-muted-foreground">
              Not enough data yet — this trend fills in as the till runs
            </Text>
          </View>
        ) : (
          <>
            <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
              <Polygon testID={`${testID}-area`} points={`${xy[0]![0]},100 ${line} ${xLast},100`} fill={color} fillOpacity={0.1} />
              <Polyline testID={`${testID}-line`} points={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            </Svg>
            {/* A circle would stretch under preserveAspectRatio="none", so the latest point is a View. */}
            <View testID={`${testID}-dot`}
              className={`absolute h-3 w-3 rounded-full border-2 border-background ${tone === 'accent' ? 'bg-primary' : 'bg-muted-foreground'}`}
              style={{ left: `${Number(xLast)}%`, top: `${Number(yLast)}%`, marginLeft: -6, marginTop: -6 }} />
          </>
        )}
      </View>
    </View>
  );
}
