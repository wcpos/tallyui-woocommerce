import { Fragment, type JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { buildClosureDocument, deriveSettled, formatClosureDate, type Closure, type Correction } from '@tallyui/pos';
import { resultText, resultWord, signedMoney } from './closure-list';
import { closureContext } from './closure-print';
import { drawerResultClass } from './till-strip';

export function ClosurePanel({ closure, corrections = [], storeName, currency, locale, blind, resolveCashierName, onReprint, onClose }: {
  closure: Closure;
  /** The closure's corrections, oldest first; none until corrections sync (no local writer yet). */
  corrections?: readonly Correction[];
  storeName: string;
  currency: string;
  locale: string;
  blind: boolean;
  resolveCashierName(id: string): string;
  onReprint(closure: Closure): void;
  onClose(): void;
}): JSX.Element {
  const money = (amount: number) => formatMoney({ amount, currency }, locale) ?? '';
  const minus = (minor: number) => minor ? `−${money(Math.abs(minor))}` : money(0);
  const { settled, touched } = deriveSettled(closure, corrections);
  const { closure: report, register } = buildClosureDocument({ ...closure, expected: settled.expected }, closureContext(storeName, currency, locale));
  const b = closure.breakdowns;
  const payment_methods = b.payment_methods as Record<string, { sales_minor?: number; refunds_minor?: number }> | undefined;
  const opening_float = b.opening_float as { expected_minor?: number | null; counted_minor?: number | null } | undefined;
  const movements = b.movements as { id: string; type: string; amountMinor?: number; reason?: string; voids?: string | null; voided_by?: string | null }[] | undefined;
  const transaction_count = b.transaction_count;
  const live = (movements ?? []).filter(m => m.type !== 'void' && !m.voided_by && !movements?.some(other => other.voids === m.id));
  const registerName = String(register.name) || 'This till';
  const opener = String(report.breakdowns.labels.opened_by_name || '') || (report.opened_by ? resolveCashierName(String(report.opened_by)) : 'Cashier');
  const closer = String(report.breakdowns.labels.closed_by_name || '') || (closure.closed_by ? resolveCashierName(closure.closed_by) : 'Cashier');
  const o = report.opened_at;
  const c = report.closed_at;
  const span = o.date_ymd === c.date_ymd ? `${o.weekday_short} ${Number(o.day)} ${o.month_short} ${o.time}–${c.time}` : `${o.date} ${o.time} → ${c.date} ${c.time}`;
  const expectedCash = settled.expected.cash ?? 0;
  const countedCash = settled.counted.cash ?? 0;
  const variance = countedCash - expectedCash;
  const recounts = corrections.filter(c => c.type === 'recount').length;
  const others = report.tenders.filter(({ name }) => name !== 'cash' && (settled.expected[name] ?? 0) !== 0);
  const noSales = live.filter(m => m.type === 'no_sale').length;
  const delta = expectedCash - (closure.expected.cash ?? 0);
  const recorded = money(closure.counted.cash ?? 0);
  const result = resultText(closure.variance.cash ?? 0, money);
  const settledAt = money(countedCash);
  const term = (key: string, label: string, value: string | number, { suffix, quiet, strong, nonMoney }: {
    suffix?: string | number; quiet?: boolean; strong?: boolean; nonMoney?: boolean;
  } = {}) => {
    const tone = `${quiet ? ' text-muted-foreground' : ''}${strong ? ' font-semibold' : ''}`;
    return <View key={key} className="flex-row items-center justify-between gap-2 border-b border-border px-2.5 py-2">
      <Text testID={`closure-${key}`} className={`min-w-0 flex-1${tone}`}>
        {label}{suffix != null && suffix !== '' && <Text className="text-muted-foreground">{' ' + suffix}</Text>}
      </Text>
      {(!blind || nonMoney) && <Text testID={`closure-${key}-amount`} className={`tabular-nums${tone}`}>{value}</Text>}
    </View>;
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent testID="closure-panel" className="max-h-[80%] overflow-hidden">
        <DialogHeader>
          <DialogTitle testID="closure-panel-title">{`Closure ${closure.number}`}</DialogTitle>
          <DialogDescription testID="closure-panel-description">{[storeName, registerName, span, closer].filter(Boolean).join(' · ')}</DialogDescription>
        </DialogHeader>
        <ScrollView testID="closure-panel-body" contentContainerClassName="gap-4">
          {!blind && <View className="items-center gap-1">
            <Text testID="closure-result-word" className="text-sm text-muted-foreground">{`Variance · ${resultWord(variance)}`}</Text>
            <Text testID="closure-figure-result" className={`text-3xl font-semibold tabular-nums ${drawerResultClass(variance)}`}>{signedMoney(variance, money)}</Text>
          </View>}
          <View className="flex-row gap-2">
            <View className="flex-1 rounded-lg border border-border px-3 py-2.5">
              <Text className="text-xs text-muted-foreground">Counted</Text>
              <Text testID="closure-figure-counted" className="text-xl font-semibold tabular-nums">{money(countedCash)}</Text>
            </View>
            {!blind && <View className="flex-1 rounded-lg border border-border px-3 py-2.5">
              <Text className="text-xs text-muted-foreground">Expected</Text>
              <Text testID="closure-figure-expected" className="text-xl font-semibold tabular-nums">{money(expectedCash)}</Text>
            </View>}
          </View>
          {touched.size > 0 && !blind && <Text testID="closure-settled" className="rounded-md border border-border px-3 py-2 text-warning">
            {`Recorded ${recorded} · ${result}. Settled at ${settledAt} after ${recounts > 0 ? `${recounts} ${recounts === 1 ? 'recount' : 'recounts'}` : 'a late sale, refund or movement'}.`}
          </Text>}
          <Text className="border-b border-border px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground">Drawer</Text>
          {term('term-float', 'Float', money(opening_float?.counted_minor ?? opening_float?.expected_minor ?? 0), { suffix: `opened ${report.opened_at.time} by ${opener}` })}
          {term('term-cash-sales', 'Cash sales', money(payment_methods?.cash?.sales_minor ?? 0))}
          {term('term-cash-refunds', 'Cash refunds', minus(payment_methods?.cash?.refunds_minor ?? 0), { quiet: (payment_methods?.cash?.refunds_minor ?? 0) === 0 })}
          {(['paid_in', 'paid_out'] as const).map(type => {
            const entries = live.filter(m => m.type === type);
            const total = entries.reduce((sum, m) => sum + (m.amountMinor ?? 0), 0);
            const suffix = entries.length === 1 && entries[0].reason ? `1 · ${entries[0].reason}` : entries.length || undefined;
            return term(type === 'paid_in' ? 'term-paid-in' : 'term-paid-out', type === 'paid_in' ? 'Paid in' : 'Paid out', type === 'paid_in' ? money(total) : minus(total), { suffix, quiet: total === 0 });
          })}
          {noSales > 0 && term('term-no-sales', 'No sales', noSales, { quiet: true, nonMoney: true })}
          {touched.has('expected.cash') && term('term-late-corrections', 'Late corrections', delta < 0 ? minus(delta) : money(delta), { suffix: corrections.filter(c => c.type !== 'recount').length })}
          {term('term-expected', 'Expected in the drawer', money(expectedCash), { strong: true })}
          {term('term-counted', 'Counted', money(countedCash), { strong: true, suffix: touched.has('counted.cash') ? 'settled' : undefined })}
          {others.length > 0 && <>
            <Text className="border-b border-border px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground">Other tenders</Text>
            {others.map(({ name, label }) => <Fragment key={name}>
              {term(`tender-expected-${name}`, String(label), money(settled.expected[name] ?? 0))}
              {settled.counted[name] != null && term(`tender-counted-${name}`, `${String(label)} · Counted`, money(settled.counted[name]), {
                quiet: true, suffix: [blind ? '' : resultText((settled.counted[name] ?? 0) - (settled.expected[name] ?? 0), money), touched.has(`counted.${name}`) ? 'settled' : ''].filter(Boolean).join(' · '),
              })}
            </Fragment>)}
          </>}
          <Text className="border-b border-border px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground">Session</Text>
          {report.breakdowns.cashiers.length > 0 && term('term-cashiers', 'Cashiers', report.breakdowns.cashiers.map(c => String(c.name)).join(' · '), { nonMoney: true })}
          {typeof transaction_count === 'number' && term('term-sales', 'Sales', String(transaction_count) + (blind ? '' : ` · ${money(settled.period_sales_total_minor)}`), { nonMoney: true })}
          {corrections.length > 0 && <>
            <Text className="border-b border-border px-2.5 pb-1 pt-3 text-xs font-medium text-muted-foreground">Corrections</Text>
            {corrections.map(c => <View key={c.id} testID={`closure-correction-${c.id}`} className="gap-1 border-b border-border px-2.5 py-3">
              <Text className="font-semibold">{c.type === 'recount' ? 'Recount' : c.type === 'late_sale' ? 'Late sale' : 'Late movement'}</Text>
              <Text>{`${c.actor.name}${c.approver ? ` · Approved by ${c.approver.name}` : ''}`}</Text>
              <Text>{c.reason}</Text>
              <Text className="text-muted-foreground">{formatClosureDate(c.created_at, { timezone: 'device', locale }).datetime}</Text>
            </View>)}
          </>}
        </ScrollView>
        <DialogFooter testID="closure-panel-footer">
          <Button testID="closure-reprint" variant="outline" onPress={() => onReprint(closure)}><Text>Print closure</Text></Button>
          <Button testID="closure-panel-close" onPress={onClose}><Text>Close</Text></Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
