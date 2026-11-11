import { useState, type JSX, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { formatClosureDate, type Closure } from '@tallyui/pos';
import { drawerResultClass } from './till-strip';

export type ClosureFilter = 'all' | 'open' | 'closed';

/** Short when the drawer was short (negative), Over when over, Exact at zero. */
export function resultWord(varianceMinor: number): 'Short' | 'Over' | 'Exact' {
  return varianceMinor < 0 ? 'Short' : varianceMinor > 0 ? 'Over' : 'Exact';
}

/** `−$1.00` / `+$0.50`; zero has no sign: `$0.00`. Uses U+2212 for minus. */
export function signedMoney(minor: number, money: (amount: number) => string): string {
  return `${minor < 0 ? '−' : minor > 0 ? '+' : ''}${money(Math.abs(minor))}`;
}

/** `Exact` at zero, else `${money(Math.abs(v))} short` / `${money(Math.abs(v))} over`. */
export function resultText(varianceMinor: number, money: (amount: number) => string): string {
  return varianceMinor === 0 ? 'Exact' : `${money(Math.abs(varianceMinor))} ${varianceMinor < 0 ? 'short' : 'over'}`;
}

export function ClosureList({ rows, sessionRows, openSessions, blind, today, currency, locale, resolveCashierName, onReprint, onOpen }: {
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
  onReprint(closure: Closure): void;
  /** A tap on a closure row's figures opens its detail panel. */
  onOpen?(closure: Closure): void;
}): JSX.Element {
  const [filter, setFilter] = useState<ClosureFilter>('all');
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
    <View testID="closure-list" className="gap-2">
      <View className="flex-row flex-wrap items-end justify-between gap-2">
        <View testID="closures-filter" className="flex-row border-b border-border">
          {(['all', 'open', 'closed'] as const).map(value => <Pressable key={value} testID={`closures-filter-${value}`}
            className={`-mb-px border-b-2 px-3 py-2 ${filter === value ? 'border-primary' : 'border-transparent'}`} role="tab" aria-selected={filter === value}
            onPress={() => setFilter(value)}>
            <Text className={`text-sm font-medium ${filter === value ? 'text-foreground' : 'text-muted-foreground'}`}>{value === 'all' ? 'All' : value === 'open' ? 'Open' : 'Closed'}</Text>
          </Pressable>)}
        </View>
        <Text testID="closures-count" className="pb-2 text-muted-foreground">{`${n} ${n === 1 ? 'session' : 'sessions'}`}</Text>
      </View>
      <View testID="closures-head" className="flex-row gap-2 py-1">
        {(blind ? ['Closure', 'Counted'] : ['Closure', 'Expected', 'Counted', 'Difference', 'Result']).map(label =>
          <Text key={label} className={`text-xs uppercase tracking-wide text-muted-foreground ${label === 'Closure' ? 'flex-1' : 'w-24 text-right'}`}>{label}</Text>)}
      </View>
      {visible.map(([day, closures]) => {
        const f = closures.length > 0 ? formatClosureDate(closures[0].opened_at, { timezone: 'device', locale }) : null;
        const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : `${f!.weekday_short} ${Number(f!.day)} ${f!.month_short}`;
        const counted = closures.reduce((sum, c) => sum + (c.counted.cash ?? 0), 0);
        const variance = closures.reduce((sum, c) => sum + (c.variance.cash ?? 0), 0);
        return <View key={day} testID={`closure-day-${day}`} className="gap-1">
          <View className="flex-row items-baseline justify-between bg-muted/50 px-3 py-2">
            <Text testID={`closure-day-label-${day}`}>{label}</Text>
            {closures.length > 0 && <Text testID={`closure-day-summary-${day}`} className="text-muted-foreground">
              {`${money(counted)} counted`}{!blind && <> · <Text className={drawerResultClass(variance)}>{resultText(variance, money)}</Text></>}
            </Text>}
          </View>
          {day === today && showSessions && <>
            {sessionRows}
            {closures.length === 0 && showRows && <Text testID="closures-none-today" className="text-muted-foreground">No closures yet today</Text>}
          </>}
          {showRows && closures.map(c => {
            const open = formatClosureDate(c.opened_at, { timezone: 'device', locale });
            const closed = formatClosureDate(c.closed_at, { timezone: 'device', locale });
            const v = c.variance.cash ?? 0;
            return <View key={c.id} testID={`closure-row-${c.id}`} className="flex-row items-center gap-2 border-b border-border py-2">
              <Pressable testID={`closure-open-${c.id}`} accessibilityRole="button" accessibilityLabel={`Open closure ${c.number}`} className="flex-1 flex-row items-center gap-2" onPress={() => onOpen?.(c)}>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text testID={`closure-title-${c.id}`} className="font-medium">{`Closure ${c.number} · ${typeof c.breakdowns.register_name === 'string' ? c.breakdowns.register_name : 'This till'}`}</Text>
                    {(c.corrections_count ?? 0) > 0 && <Text testID={`closure-badge-${c.id}`} className="text-xs font-semibold text-warning">Corrected</Text>}
                  </View>
                  <Text testID={`closure-subline-${c.id}`} className="text-sm text-muted-foreground">{`${open.time} → ${closed.time} · ${c.closed_by ? resolveCashierName(c.closed_by) : 'Cashier'}`}</Text>
                </View>
                {!blind && <Text testID={`closure-expected-${c.id}`} className="w-24 text-right tabular-nums">{money(c.expected.cash ?? 0)}</Text>}
                <Text testID={`closure-counted-${c.id}`} className="w-24 text-right tabular-nums">{money(c.counted.cash ?? 0)}</Text>
                {!blind && <>
                  <Text testID={`closure-difference-${c.id}`} className={`w-24 text-right tabular-nums ${drawerResultClass(v)}`}>{signedMoney(v, money)}</Text>
                  <Text testID={`closure-result-${c.id}`} className={`w-24 text-right font-semibold ${drawerResultClass(v)}`}>{resultWord(v)}</Text>
                </>}
              </Pressable>
              <Button testID={`closure-reprint-${c.id}`} variant="outline" size="sm" onPress={() => onReprint(c)}><Text>Reprint</Text></Button>
            </View>;
          })}
        </View>;
      })}
      {visible.length === 0 && <Text testID="closures-empty" className="text-muted-foreground">No closures in this period</Text>}
    </View>
  );
}
