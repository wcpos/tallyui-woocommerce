import { View } from 'react-native';
import { Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import type { HourBucket } from '../lib/reports/sales-room';

export function HourlyBars({ hours, currency, locale }: {
  hours: readonly HourBucket[]; currency: string; locale: string;
}) {
  if (hours.length === 0) return null;
  const money = (amount: number) => formatMoney({ amount, currency }, locale);
  let max = 0;
  let busiest: HourBucket | undefined;
  for (const bucket of hours) {
    max = Math.max(max, bucket.today.totalMinor, bucket.yesterday.totalMinor);
    if (bucket.today.totalMinor > 0 && (!busiest || bucket.today.totalMinor > busiest.today.totalMinor
      || (bucket.today.totalMinor === busiest.today.totalMinor && bucket.hour < busiest.hour))) {
      busiest = bucket;
    }
  }
  const pct = (value: number) => max > 0 ? Math.round((100 * value) / max) : 0;

  return (
    <View testID="sales-room-hours" className="gap-2 rounded-lg border border-border p-4">
      <Text accessibilityRole="header">By hour</Text>
      {busiest && <Text>{`Busiest hour: ${String(busiest.hour).padStart(2, '0')}:00 · ${money(busiest.today.totalMinor)} · ${busiest.today.count} ${busiest.today.count === 1 ? 'order' : 'orders'}`}</Text>}
      <Text className="text-sm text-muted-foreground">Filled: today · Dashed: yesterday</Text>
      <View className="h-32 flex-row gap-1">
        {hours.map(({ hour, today, yesterday }) => {
          const HH = String(hour).padStart(2, '0');
          return (
            <View
              key={hour}
              testID={`sales-hour-${HH}`}
              className="flex-1 items-center justify-end"
              accessibilityLabel={`${HH}:00 — today ${money(today.totalMinor)}, ${today.count} ${today.count === 1 ? 'order' : 'orders'}; yesterday ${money(yesterday.totalMinor)}`}
            >
              <View className="relative w-full max-w-12 flex-1 justify-end">
                <View
                  testID={`sales-hour-${HH}-today`}
                  className="rounded-sm bg-primary"
                  style={{ height: `${pct(today.totalMinor)}%` }}
                />
                {yesterday.totalMinor > 0 && (
                  <View
                    testID={`sales-hour-${HH}-yesterday`}
                    className="absolute bottom-0 left-0 right-0 rounded-sm border-2 border-dashed border-muted-foreground"
                    style={{ height: `${pct(yesterday.totalMinor)}%` }}
                  />
                )}
              </View>
              <Text className="text-center text-sm text-muted-foreground">{HH}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
