import type { JSX } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import type { Closure } from '@tallyui/pos';
import { resultWord, signedMoney } from './closure-list';
import { drawerResultClass } from './till-strip';

/** The float a closure opened with: `writeClosure` freezes it in `breakdowns.opening_float` (counted, else expected). */
export function openingFloatMinor(closure: Closure): number {
  const float = closure.breakdowns.opening_float as { counted_minor?: unknown; expected_minor?: unknown } | undefined;
  const value = float?.counted_minor ?? float?.expected_minor;
  return typeof value === 'number' ? value : 0;
}

/** v2's headline strip over Closures (`closure-stats.tsx`): sums in integer minor units; blind shows nothing. */
export function ClosureStats({ rows, openSession, blind, currency, locale }: {
  rows: readonly Closure[];
  /** The session open or counting on this till, if any. */
  openSession: { counted_float_minor: number } | null;
  blind: boolean;
  currency: string;
  locale: string;
}): JSX.Element | null {
  const phone = useWindowDimensions().width < 640;
  if (blind) return null;
  const money = (amount: number) => formatMoney({ amount, currency }, locale) ?? '';
  const sum = (value: (row: Closure) => number) => rows.reduce((total, row) => total + value(row), 0);
  const opening = sum(openingFloatMinor);
  const activity = sum(row => row.expected.cash ?? 0) - opening;
  const variance = sum(row => row.variance.cash ?? 0);
  const open = openSession ? 1 : 0;
  const results = (['Short', 'Over', 'Exact'] as const)
    .map(word => [word, rows.filter(row => resultWord(row.variance.cash ?? 0) === word).length] as const)
    .filter(([, n]) => n > 0)
    .map(([word, n]) => `${n} ${word.toLowerCase()}`)
    .join(' · ');
  const cells: [id: string, label: string, value: string | number, note: string, tone?: string][] = [
    ['discrepancy', 'Discrepancy', variance ? signedMoney(variance, money) : '—', results, variance ? drawerResultClass(variance) : undefined],
    ['sessions', 'Sessions', rows.length + open, `${open} open · ${rows.length} closed`],
    ['cash-at-open', 'Cash at open', money(opening + (openSession?.counted_float_minor ?? 0)), 'floats'],
    ['cash-activity', 'Cash activity', `${activity < 0 ? '−' : '+'}${money(Math.abs(activity))}`, 'sales − refunds ± movements'],
    ['cash-at-close', 'Cash at close', rows.length ? money(sum(row => row.counted.cash ?? 0)) : '—',
      rows.length ? `${rows.length} ${rows.length === 1 ? 'count' : 'counts'}` : 'nothing closed yet'],
  ];
  return (
    <View testID="closure-stats" className={`flex-row border-b border-border pb-3${phone ? ' flex-wrap' : ''}`}>
      {cells.map(([id, label, value, note, tone], index) => {
        const width = phone ? (index === 0 ? ' w-full' : ' w-1/2') : ' flex-1';
        const ruled = (phone ? index % 2 === 1 : index < cells.length - 1) ? ' border-r border-border' : '';
        return <View key={id} className={`px-4 py-3${index === 0 ? ' pl-0' : ''}${width}${ruled}${phone && index > 0 ? ' border-t border-border' : ''}`}>
          <Text className="text-sm text-muted-foreground">{label}</Text>
          <Text testID={`closure-stat-${id}`} className={`text-lg font-semibold tabular-nums${tone ? ` ${tone}` : ''}`}>{value}</Text>
          <Text className="text-sm text-muted-foreground">{note}</Text>
        </View>;
      })}
    </View>
  );
}
