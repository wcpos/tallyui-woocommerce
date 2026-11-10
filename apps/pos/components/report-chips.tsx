import { Pressable, View } from 'react-native';
import { Text } from '@tallyui/components';
import type { Compare } from '../lib/reports/sales-room';

export type ReportCashier = { id: string; name: string };

export function reportCashiers(users: readonly { id: number | string; displayName: string }[]): ReportCashier[] {
  const seen = new Set<string>();
  const rows: ReportCashier[] = [];
  for (const user of users) {
    const id = String(user.id);
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ id, name: user.displayName });
  }
  return rows;
}

function Segment<T extends string>({ testID, value, choices, onChange }: {
  testID: string; value: T; choices: readonly { value: T; label: string }[]; onChange(next: T): void;
}) {
  return (
    <View testID={testID} className="flex-row flex-wrap rounded-md bg-muted p-1">
      {choices.map(choice => <Pressable key={choice.value} testID={`${testID}-${choice.value}`}
        className={`rounded-sm px-3 py-1.5${value === choice.value ? ' bg-background' : ''}`} role="tab" aria-selected={value === choice.value}
        onPress={() => onChange(choice.value)}>
        <Text className={`text-sm font-medium ${value === choice.value ? 'text-foreground' : 'text-muted-foreground'}`}>{choice.label}</Text>
      </Pressable>)}
    </View>
  );
}

export function ReportChips({ cashiers, cashierId, onCashier, compare, onCompare, weekday }: {
  cashiers: readonly ReportCashier[]; cashierId: string | null; onCashier(next: string | null): void;
  compare: Compare; onCompare(next: Compare): void; weekday: string;
}) {
  return (
    <View testID="hero-chips" className="gap-2">
      <View className="flex-row flex-wrap gap-2">
        <Segment
          testID="hero-cashier"
          value={cashierId ?? 'all'}
          choices={[{ value: 'all', label: 'Everyone' }, ...cashiers.map(row => ({ value: row.id, label: row.name }))]}
          onChange={next => onCashier(next === 'all' ? null : next)}
        />
        <Segment<Compare>
          testID="hero-compare"
          value={compare}
          choices={[{ value: 'yesterday', label: 'vs yesterday' }, { value: 'lastweek', label: `vs last ${weekday}` }]}
          onChange={onCompare}
        />
      </View>
      <Text testID="hero-compare-hint" className="text-sm text-muted-foreground">A live day is compared at the same time of day</Text>
    </View>
  );
}
