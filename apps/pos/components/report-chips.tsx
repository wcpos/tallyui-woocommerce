import { Pressable, View } from 'react-native';
import { Circle, Path, Rect } from 'react-native-svg';
import { Button, createSvgIcon, IconButton, Text } from '@tallyui/components';
import type { Compare } from '../lib/reports/sales-room';
import { chipFaceClassName, MenuChip } from './menu-chip';

// lucide `user-star`, v2's `cashier` icon (a person with a star) on the Everyone / All cashiers chip.
const CashierIcon = createSvgIcon('CashierIcon', () => <>
  <Path d="M16.051 12.616a1 1 0 0 1 1.909.024l.737 1.452a1 1 0 0 0 .737.535l1.634.256a1 1 0 0 1 .588 1.806l-1.172 1.168a1 1 0 0 0-.282.866l.259 1.613a1 1 0 0 1-1.541 1.134l-1.465-.75a1 1 0 0 0-.912 0l-1.465.75a1 1 0 0 1-1.539-1.133l.258-1.613a1 1 0 0 0-.282-.867l-1.156-1.152a1 1 0 0 1 .572-1.822l1.633-.256a1 1 0 0 0 .737-.535z" />
  <Path d="M8 15H7a4 4 0 0 0-4 4v2" />
  <Circle cx={10} cy={7} r={4} />
</>);

// lucide `arrow-right-left`, v2's `swap` icon on the comparison chip.
const SwapIcon = createSvgIcon('SwapIcon', () => <>
  <Path d="m16 3 4 4-4 4" />
  <Path d="M20 7H4" />
  <Path d="m8 21-4-4 4-4" />
  <Path d="M4 17h16" />
</>);

export type ReportCashier = { id: string; name: string };

// lucide `printer`, v2's `print` icon on Print summary, the till strip's print button and the session card's X-report.
export const PrintIcon = createSvgIcon('PrintIcon', () => <>
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

/** The scope chips (v2 `SalesScopeChips`); Closures' cashier chip (v2 `ClosuresCashierChip`) reads "All cashiers". */
export function ReportChips({ cashiers, cashierId, onCashier, allLabel = 'Everyone', testID = 'hero-chips' }: {
  cashiers: readonly ReportCashier[]; cashierId: string | null; onCashier(next: string | null): void;
  allLabel?: string; testID?: string;
}) {
  // No status chip (v2 "Completed & processing"): a local sale has no Woo order status and is always completed.
  return (
    <View testID={testID} className="flex-row flex-wrap gap-2">
      <MenuChip
        name="cashier"
        icon={CashierIcon}
        value={cashierId ?? 'all'}
        defaultValue="all"
        choices={[{ value: 'all', label: allLabel }, ...cashiers.map(row => ({ value: row.id, label: row.name }))]}
        onChange={next => onCashier(next === 'all' ? null : next)}
      />
    </View>
  );
}

/** The hero's comparison chip (v2 `Hero` `compareChip`); a multi-day period's `fixed` comparison is a dimmed, disabled chip. */
export function CompareChip({ compare, onCompare, weekday, fixed }: {
  compare: Compare; onCompare(next: Compare): void; weekday: string; fixed?: string;
}) {
  // v2 `<Chip icon="swap" disabled dimmed />`: the same pill at `opacity-45`.
  if (fixed) return (
    <Pressable testID="hero-chip-compare" disabled accessibilityRole="button" accessibilityState={{ disabled: true }}
      className={`${chipFaceClassName(false)} gap-1.5 px-3 opacity-45`}>
      <SwapIcon testID="hero-chip-compare-icon" size={18} className="text-foreground" />
      <Text className="text-base font-normal text-foreground">{fixed}</Text>
    </Pressable>
  );
  return (
    <MenuChip
      name="compare"
      icon={SwapIcon}
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
