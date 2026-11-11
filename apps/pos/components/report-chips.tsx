import { View } from 'react-native';
import { Path, Rect } from 'react-native-svg';
import { Button, createSvgIcon, IconButton, Text } from '@tallyui/components';
import type { Compare } from '../lib/reports/sales-room';
import { MenuChip } from './menu-chip';

export type ReportCashier = { id: string; name: string };

// lucide `printer`, v2's `print` icon on Print summary.
const PrintIcon = createSvgIcon('PrintIcon', () => <>
  <Path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
  <Path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
  <Rect x="6" y="14" width="12" height="8" rx="1" />
</>);

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

/** The scope chips (v2 `SalesScopeChips`). */
export function ReportChips({ cashiers, cashierId, onCashier }: {
  cashiers: readonly ReportCashier[]; cashierId: string | null; onCashier(next: string | null): void;
}) {
  // No status chip (v2 "Completed & processing"): a local sale has no Woo order status and is always completed.
  return (
    <View testID="hero-chips" className="flex-row flex-wrap gap-2">
      <MenuChip
        name="cashier"
        value={cashierId ?? 'all'}
        defaultValue="all"
        choices={[{ value: 'all', label: 'Everyone' }, ...cashiers.map(row => ({ value: row.id, label: row.name }))]}
        onChange={next => onCashier(next === 'all' ? null : next)}
      />
    </View>
  );
}

/** The hero's comparison chip (v2 `Hero` `compareChip`). */
export function CompareChip({ compare, onCompare, weekday }: { compare: Compare; onCompare(next: Compare): void; weekday: string }) {
  return (
    <MenuChip
      name="compare"
      value={compare}
      defaultValue="yesterday"
      choices={[{ value: 'yesterday', label: 'vs yesterday' }, { value: 'lastweek', label: `vs last ${weekday}` }]}
      onChange={next => onCompare(next as Compare)}
      hint="A live day is compared at the same time of day"
    />
  );
}

/** The scope strip's Print summary (v2 `HeroPrint`): an outline button, an icon button on a phone. */
export function PrintSummaryButton({ wide, onPress }: { wide: boolean; onPress(): void }) {
  return wide
    ? <Button testID="reports-print-summary" variant="outline" onPress={onPress}><PrintIcon size={16} /><Text>Print summary</Text></Button>
    : <IconButton testID="reports-print-summary" variant="outline" accessibilityLabel="Print summary" onPress={onPress}><PrintIcon size={20} /></IconButton>;
}
