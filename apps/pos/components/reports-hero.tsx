import type { ReactNode } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Text } from '@tallyui/components';

export type HeroFigures = { count: number; totalMinor: number; averageMinor: number; items: number };

/** Below this window width the figure sits above its companions (v2 hero `phone`). */
const WIDE_MIN_WIDTH = 600;

/** v2 reports/hero `tone`: up reads good, down bad, no change or no comparison muted. */
const tone = (value: number) => value > 0 ? 'text-success' : value < 0 ? 'text-destructive' : 'text-muted-foreground';

/** v2 reports/hero `signed`: `±0`, or a sign and the formatted size; the minus is U+2212. */
const signed = (value: number, format: (value: number) => string) =>
  value === 0 ? '±0' : `${value > 0 ? '+' : '−'}${format(Math.abs(value))}`;

/** One difference line (v2 `Difference`); a null delta has nothing to compare with and reads `—`. */
function Difference({ testID, delta, text }: { testID: string; delta: number | null; text: string }) {
  return (
    <Text testID={testID} accessibilityLabel={delta === null ? 'No comparison' : undefined}
      className={`text-sm font-semibold ${tone(delta ?? 0)}`}>
      {delta === null ? '—' : text}
    </Text>
  );
}

/** The Reports headline row (v2 reports/hero `Figures`): the day's total, then Orders, Average order and Items. */
export function ReportsHero({ today, previous, comparisonLabel, money, onOpenOrders, children }: {
  today: HeroFigures; previous: HeroFigures; comparisonLabel: string;
  money(minor: number): string; onOpenOrders(): void; children?: ReactNode;
}) {
  const wide = useWindowDimensions().width >= WIDE_MIN_WIDTH;
  // No orders to compare with: every line reads "—", never a difference against nothing.
  const compared = previous.count > 0;
  // The percentage is rounded to its displayed tenth before the sign and tone are chosen.
  const percent = !compared || previous.totalMinor === 0 ? null
    : Math.round(((today.totalMinor - previous.totalMinor) / previous.totalMinor) * 1000) / 10;
  const count = (value: number) => String(value);
  const companions = [
    { id: 'orders', label: 'Orders', value: today.count, delta: today.count - previous.count, format: count },
    { id: 'average', label: 'Average order', value: today.averageMinor, delta: today.averageMinor - previous.averageMinor, format: money },
    { id: 'items', label: 'Items', value: today.items, delta: today.items - previous.items, format: count },
  ];
  return (
    <View testID="reports-hero" className="gap-4 rounded-lg border border-border p-4">
      <View className={wide ? 'flex-row items-center justify-between gap-6' : 'gap-5'}>
        <View testID="hero-figure" className="gap-1">
          <Text testID="hero-total" className="text-4xl font-bold tabular-nums">{money(today.totalMinor)}</Text>
          <Difference testID="hero-delta" delta={percent}
            text={percent === null ? '' : `${signed(percent, n => n.toFixed(1))}% ${comparisonLabel}`} />
        </View>
        <View testID="hero-companions" className={`flex-row gap-4${wide ? ' flex-1' : ''}`}>
          {companions.map(item => {
            const column = <>
              <Text className="text-sm text-muted-foreground">{item.label}</Text>
              <Text testID={`hero-${item.id}`} className="text-2xl font-semibold tabular-nums">{item.format(item.value)}</Text>
              <Difference testID={`hero-${item.id}-delta`} delta={compared ? item.delta : null} text={signed(item.delta, item.format)} />
            </>;
            return item.id === 'orders'
              ? <Pressable key={item.id} testID="sales-room-orders-open" accessibilityRole="button"
                  accessibilityLabel="Open Orders table" className="min-w-0 flex-1 gap-1" onPress={onOpenOrders}>{column}</Pressable>
              : <View key={item.id} className="min-w-0 flex-1 gap-1">{column}</View>;
          })}
        </View>
      </View>
      {children}
    </View>
  );
}
