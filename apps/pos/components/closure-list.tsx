import { useState, type JSX, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Path } from 'react-native-svg';
import { Badge, Button, createSvgIcon, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { formatClosureDate, type Closure } from '@tallyui/pos';
import { useIsWide } from '../lib/layout/wide';
import { ChevronRightIcon } from './icons';
import { drawerResultClass } from './till-strip';

export type ClosureFilter = 'all' | 'open' | 'closed';

type Tone = 'bad' | 'ok' | 'muted' | 'warning';
// v2 `Badge tinted size="lg"` (components/src/badge/index.tsx): the tone at 15% under foreground words; muted is solid.
const TONE_BADGE: Record<Tone, { variant: 'destructive' | 'success' | 'secondary' | 'warning'; className: string; text: string }> = {
  bad: { variant: 'destructive', className: 'bg-destructive/15', text: 'text-foreground' },
  ok: { variant: 'success', className: 'bg-success/15', text: 'text-foreground' },
  warning: { variant: 'warning', className: 'bg-warning/15', text: 'text-foreground' },
  muted: { variant: 'secondary', className: 'bg-muted', text: 'text-muted-foreground' },
};
function ToneBadge({ testID, tone, children }: { testID: string; tone: Tone; children: string }): JSX.Element {
  const badge = TONE_BADGE[tone];
  return <Badge testID={testID} variant={badge.variant} className={`h-6 min-w-6 justify-center self-start px-2 py-0 ${badge.className}`}>
    <Text className={`text-sm font-bold tabular-nums ${badge.text}`}>{children}</Text>
  </Badge>;
}

// lucide `file-text`, for v2's `leftIcon="document"` on Export CSV.
const DocumentIcon = createSvgIcon('DocumentIcon', () => <>
  <Path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
  <Path d="M14 2v4a2 2 0 0 0 2 2h4" />
  <Path d="M10 9H8" />
  <Path d="M16 13H8" />
  <Path d="M16 17H8" />
</>);

/** v2 `ClosuresExportButton` (reports/closures/index.tsx): an outline button with a leading icon, on v2's outline
 *  face (`bg-card`, tinted `bg-accent` under the pointer). The CSV holds closures, so Open disables it. */
export function ClosuresExportButton({ disabled, onPress }: { disabled?: boolean; onPress(): void }): JSX.Element {
  return (
    <Button testID="closures-csv" variant="outline" className="bg-card web:hover:bg-accent" disabled={disabled} onPress={onPress}>
      <DocumentIcon testID="closures-csv-icon" size={18} className="text-foreground" />
      <Text>Export CSV</Text>
    </Button>
  );
}

/** Short when the drawer was short (negative), Over when over, Exact at zero. */
export function resultWord(varianceMinor: number): 'Short' | 'Over' | 'Exact' {
  return varianceMinor < 0 ? 'Short' : varianceMinor > 0 ? 'Over' : 'Exact';
}

export function resultTone(varianceMinor: number): 'bad' | 'ok' | 'muted' {
  return varianceMinor < 0 ? 'bad' : varianceMinor > 0 ? 'ok' : 'muted';
}

/** `−$1.00` / `+$0.50`; zero has no sign: `$0.00`. Uses U+2212 for minus. */
export function signedMoney(minor: number, money: (amount: number) => string): string {
  return `${minor < 0 ? '−' : minor > 0 ? '+' : ''}${money(Math.abs(minor))}`;
}

/** `Exact` at zero, else `${money(Math.abs(v))} short` / `${money(Math.abs(v))} over`. */
export function resultText(varianceMinor: number, money: (amount: number) => string): string {
  return varianceMinor === 0 ? 'Exact' : `${money(Math.abs(varianceMinor))} ${varianceMinor < 0 ? 'short' : 'over'}`;
}

export function ClosureList({ rows, sessionRows, openSessions, blind, today, currency, locale, resolveCashierName, onOpen, filter: held, onFilterChange }: {
  rows: readonly Closure[];
  /** Rendered under the Today heading, at the head of the list (the open-session card). */
  sessionRows?: ReactNode;
  /** 1 while a session is open or counting, else 0. */
  openSessions: number;
  blind: boolean;
  /** `yyyy-MM-dd`, the device's business day. */
  today: string;
  currency: string;
  locale: string;
  resolveCashierName(id: string): string;
  /** A tap on a closure row's figures opens its detail panel. */
  onOpen?(closure: Closure): void;
  /** The All / Open / Closed tab when the screen holds it (v2 lifts it to disable Export CSV on Open); else the list keeps its own. */
  filter?: ClosureFilter;
  onFilterChange?(next: ClosureFilter): void;
}): JSX.Element {
  const phone = !useIsWide();
  const [own, setOwn] = useState<ClosureFilter>('all');
  const filter = held ?? own;
  const setFilter = (next: ClosureFilter) => {
    if (held === undefined) setOwn(next);
    onFilterChange?.(next);
  };
  const money = (amount: number) => formatMoney({ amount, currency }, locale) ?? '';
  const n = rows.length + openSessions;
  const showSessions = openSessions > 0 && filter !== 'closed';
  const showRows = filter !== 'open';
  const byDay = new Map<string, Closure[]>();
  for (const row of rows) {
    const day = row.business_day ?? '';
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(row);
  }
  const groups = [...byDay];
  if (showSessions && !byDay.has(today)) groups.unshift([today, []]);
  const visible = groups.filter(([day, closures]) => (showRows && closures.length > 0) || (day === today && showSessions));
  const [year, month, date] = today.split('-').map(Number);
  const yesterday = formatClosureDate(new Date(year, month - 1, date - 1).toISOString(), { timezone: 'device', locale }).date_ymd;

  return (
    // v2 `ClosureList`'s `<Card>` (`border-border bg-card rounded-lg border`): the tabs, the heads, the day bands and
    // the rows all sit on it, the rows ruled above and inset 16 (`ListRow className="border-t border-b-0 px-4"`).
    <View testID="closure-list" className="overflow-hidden rounded-lg border border-border bg-card">
      <View className="flex-row flex-wrap items-end justify-between gap-2 px-3 pt-2">
        <View testID="closures-filter" className="flex-row border-b border-border">
          {(['all', 'open', 'closed'] as const).map(value => <Pressable key={value} testID={`closures-filter-${value}`}
            className={`-mb-px border-b-2 px-3 py-2 ${filter === value ? 'border-primary' : 'border-transparent'}`} role="tab" aria-selected={filter === value}
            onPress={() => setFilter(value)}>
            <Text className={`text-sm font-medium ${filter === value ? 'text-foreground' : 'text-muted-foreground'}`}>{value === 'all' ? 'All' : value === 'open' ? 'Open' : 'Closed'}</Text>
          </Pressable>)}
        </View>
        <Text testID="closures-count" className="pb-2 text-muted-foreground">{`${n} ${n === 1 ? 'session' : 'sessions'}`}</Text>
      </View>
      {!phone && <View testID="closures-head" className="flex-row gap-3 px-4 py-2">
        {(blind ? ['Closure', 'Counted'] : ['Closure', 'Expected', 'Counted', 'Difference', 'Result']).map(label =>
          <Text key={label} className={`text-xs uppercase tracking-wide text-muted-foreground ${label === 'Closure' ? 'flex-1' : label === 'Result' ? 'w-20 text-right' : 'w-28 text-right'}`}>{label}</Text>)}
        <View testID="closures-head-chevron" className="w-4.5" />
      </View>}
      {visible.map(([day, closures]) => {
        const f = closures.length > 0 ? formatClosureDate(closures[0].opened_at, { timezone: 'device', locale }) : null;
        const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : `${f!.weekday_short} ${Number(f!.day)} ${f!.month_short}`;
        const counted = closures.reduce((sum, c) => sum + (c.counted.cash ?? 0), 0);
        const variance = closures.reduce((sum, c) => sum + (c.variance.cash ?? 0), 0);
        return <View key={day} testID={`closure-day-${day}`}>
          <View className="flex-row items-baseline justify-between bg-muted/50 px-4 py-2">
            <Text testID={`closure-day-label-${day}`}>{label}</Text>
            {closures.length > 0 && <Text testID={`closure-day-summary-${day}`} className="text-muted-foreground">
              {`${money(counted)} counted`}{!blind && <> · <Text className={drawerResultClass(variance)}>{resultText(variance, money)}</Text></>}
            </Text>}
          </View>
          {day === today && showSessions && <>
            {sessionRows}
            {closures.length === 0 && showRows && <Text testID="closures-none-today" className="border-t border-border px-4 py-2 text-muted-foreground">No closures yet today</Text>}
          </>}
          {showRows && closures.map(c => {
            const open = formatClosureDate(c.opened_at, { timezone: 'device', locale });
            const closed = formatClosureDate(c.closed_at, { timezone: 'device', locale });
            const v = c.variance.cash ?? 0;
            const corrected = (c.corrections_count ?? 0) > 0;
            // v2 closure-list.tsx:265: the stamped closer name first, as the panel, print and Closures CSV read it.
            const closer = String(c.breakdowns.closed_by_name || '') || (c.closed_by ? resolveCashierName(c.closed_by) : 'Cashier');
            return <View key={c.id} testID={`closure-row-${c.id}`} className="flex-row items-center gap-2 border-t border-border px-4 py-2">
              <Pressable testID={`closure-open-${c.id}`} accessibilityRole="button" accessibilityLabel={`Open closure ${c.number}`} className="flex-1 flex-row items-center gap-3" onPress={() => onOpen?.(c)}>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text testID={`closure-title-${c.id}`} className="font-medium">{`Closure ${c.number} · ${typeof c.breakdowns.register_name === 'string' ? c.breakdowns.register_name : 'This till'}`}</Text>
                  </View>
                  <Text testID={`closure-subline-${c.id}`} className="text-sm text-muted-foreground">{`${open.time} → ${closed.time} · ${closer}`}</Text>
                  {phone && <Text testID={`closure-figures-${c.id}`} className="text-sm text-muted-foreground tabular-nums">
                    {!blind && <>Expected <Text className="text-foreground">{money(c.expected.cash ?? 0)}</Text>{' · '}</>}
                    Counted <Text className="text-foreground">{money(c.counted.cash ?? 0)}</Text>
                    {!blind && <>{' · Difference '}<Text className={drawerResultClass(v)}>{signedMoney(v, money)}</Text></>}
                  </Text>}
                  {((phone && !blind) || corrected) && <View className="flex-row gap-2">
                    {phone && !blind && <ToneBadge testID={`closure-result-${c.id}`} tone={resultTone(v)}>{resultWord(v)}</ToneBadge>}
                    {corrected && <ToneBadge testID={`closure-badge-${c.id}`} tone="warning">Corrected</ToneBadge>}
                  </View>}
                </View>
                {!phone && <>
                  {!blind && <Text testID={`closure-expected-${c.id}`} className="w-28 text-right tabular-nums text-muted-foreground">{money(c.expected.cash ?? 0)}</Text>}
                  <Text testID={`closure-counted-${c.id}`} className="w-28 text-right tabular-nums">{money(c.counted.cash ?? 0)}</Text>
                  {!blind && <>
                    <Text testID={`closure-difference-${c.id}`} className={`w-28 text-right tabular-nums ${drawerResultClass(v)}`}>{signedMoney(v, money)}</Text>
                    <View className="w-20 items-end"><ToneBadge testID={`closure-result-${c.id}`} tone={resultTone(v)}>{resultWord(v)}</ToneBadge></View>
                  </>}
                </>}
                <ChevronRightIcon testID={`closure-chevron-${c.id}`} size={18} className="text-muted-foreground" />
              </Pressable>
            </View>;
          })}
        </View>;
      })}
      {visible.length === 0 && <Text testID="closures-empty" className="p-4 text-muted-foreground">No closures in this period</Text>}
    </View>
  );
}
