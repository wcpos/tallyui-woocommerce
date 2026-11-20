import { StyleSheet, View } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';
import { useCSSVariable } from 'uniwind';
import { Text } from '@tallyui/components';
import { MIN_TREND_POINTS, type TrendPoint } from '../lib/health/performance';
import { niceCeil, xTickValues, yTickValues } from '../lib/health/trend-scale';

const coordinate = (value: number) => String(Number(value.toFixed(2)));
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * A Store health trend (v2 health/trend-frame.tsx + trend-line-chart.tsx): a label and latest-value header over a
 * fixed-height plot, drawn from the first render. Under two samples the plot says "not enough data yet" instead of a
 * line; otherwise a 2px line over a faint area wash on a zero-based scale, the latest point marked. v2's axes are ported
 * (trend-scale.ts): a nice 1/2/5 × 10ⁿ top, y labels and gridlines at 0, the midpoint and the top, and up to four
 * clock labels on real hour buckets, ends included. v2's pointer readout is not ported yet.
 */
export function TrendLine({ testID, label, points, tone, formatValue }: {
  testID: string; label: string; points: TrendPoint[]; tone: 'accent' | 'neutral'; formatValue(value: number): string;
}) {
  const [primary, muted] = useCSSVariable(['--color-primary', '--color-muted-foreground'])
    .map(value => value === undefined ? undefined : String(value));
  const color = tone === 'accent' ? primary : muted;
  const first = points[0];
  const last = points.at(-1);
  const top = niceCeil(Math.max(...points.map(point => point.y)));
  const span = first && last ? last.x - first.x || 1 : 1;
  const xAt = (x: number) => (100 * (x - (first?.x ?? 0))) / span;
  const yAt = (y: number) => 100 - (100 * y) / top;
  const xy = points.map(point => [coordinate(xAt(point.x)), coordinate(yAt(point.y))] as const);
  const xTicks = xTickValues(points);
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
            <View className="flex-1 flex-row gap-1">
              <View className="w-10">
                {yTickValues(top).map((value, i) => {
                  const at = yAt(value);
                  // The top label hangs from the top edge, 0 sits on the bottom edge, the midpoint centres on its line.
                  const place = at === 0 ? { top: 0 } : at === 100 ? { bottom: 0 } : { top: `${at}%` as const, marginTop: -8 };
                  return (
                    <Text key={i} testID={`${testID}-ytick-${i}`} numberOfLines={1}
                      className="absolute right-0 text-right text-xs text-muted-foreground tabular-nums" style={place}>
                      {formatValue(value)}
                    </Text>
                  );
                })}
              </View>
              <View className="relative flex-1">
                {yTickValues(top).map((value, i) => (
                  <View key={i} testID={`${testID}-grid-${i}`} className="absolute left-0 right-0 border-t border-border"
                    style={{ top: `${yAt(value)}%` }} />
                ))}
                <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
                  <Polygon testID={`${testID}-area`} points={`${xy[0]![0]},100 ${line} ${xLast},100`} fill={color} fillOpacity={0.1} />
                  <Polyline testID={`${testID}-line`} points={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
                </Svg>
                {/* A circle would stretch under preserveAspectRatio="none", so the latest point is a View. */}
                <View testID={`${testID}-dot`}
                  className={`absolute h-3 w-3 rounded-full border-2 border-background ${tone === 'accent' ? 'bg-primary' : 'bg-muted-foreground'}`}
                  style={{ left: `${Number(xLast)}%`, top: `${Number(yLast)}%`, marginLeft: -6, marginTop: -6 }} />
              </View>
            </View>
            {/* The end labels align to the plot's edges so neither spills out of the card; inner ones centre on their hour. */}
            <View className="relative ml-11 mt-1 h-4">
              {xTicks.map((x, i) => {
                const place = i === 0 ? { left: 0 } : i === xTicks.length - 1 ? { right: 0 }
                  : { left: `${xAt(x)}%` as const, width: 64, marginLeft: -32, textAlign: 'center' as const };
                return (
                  <Text key={x} testID={`${testID}-xtick-${i}`} numberOfLines={1}
                    className="absolute text-xs text-muted-foreground tabular-nums" style={place}>
                    {clock(x)}
                  </Text>
                );
              })}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
