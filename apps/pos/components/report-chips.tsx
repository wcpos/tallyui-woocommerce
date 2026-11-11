import { View } from 'react-native';
import type { Compare } from '../lib/reports/sales-room';
import { MenuChip } from './menu-chip';

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

export function ReportChips({ cashiers, cashierId, onCashier, compare, onCompare, weekday }: {
  cashiers: readonly ReportCashier[]; cashierId: string | null; onCashier(next: string | null): void;
  compare: Compare; onCompare(next: Compare): void; weekday: string;
}) {
  return (
    <View testID="hero-chips" className="flex-row flex-wrap gap-2">
      <MenuChip
        name="cashier"
        value={cashierId ?? 'all'}
        defaultValue="all"
        choices={[{ value: 'all', label: 'Everyone' }, ...cashiers.map(row => ({ value: row.id, label: row.name }))]}
        onChange={next => onCashier(next === 'all' ? null : next)}
      />
      <MenuChip
        name="compare"
        value={compare}
        defaultValue="yesterday"
        choices={[{ value: 'yesterday', label: 'vs yesterday' }, { value: 'lastweek', label: `vs last ${weekday}` }]}
        onChange={next => onCompare(next as Compare)}
        hint="A live day is compared at the same time of day"
      />
    </View>
  );
}
