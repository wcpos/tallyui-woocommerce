import { Fragment, type JSX } from 'react';
import { ScrollView, View } from 'react-native';
import { Path } from 'react-native-svg';
import { Button, createSvgIcon, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, IconButton, Text, XIcon } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { buildClosureDocument, deriveSettled, formatClosureDate, type Closure, type Correction } from '@tallyui/pos';
import { useIsWide } from '../lib/layout/wide';
import { resultText, resultWord, signedMoney } from './closure-list';
import { closureContext } from './closure-print';
import { ChevronLeftIcon } from './icons';
import { RIGHT_SHEET, SHEET_TITLE, SheetCloseButton } from './sheet';
import { drawerResultClass } from './till-strip';

// v2 report-panel.tsx:21-26 uses a full page on a phone.
const PHONE_PAGE = 'left-0 right-0 top-0 h-full w-full max-w-full translate-x-0 translate-y-0 gap-4 rounded-none border-0 bg-card p-0 py-4';

const CheckGlyph = createSvgIcon('CheckGlyph', () => <Path d="m5 12l5 5L20 7" />);
const AlertGlyph = createSvgIcon('AlertGlyph', () => <Path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9-4v4m0 4h.01" />);
const InfoGlyph = createSvgIcon('InfoGlyph', () => <><Path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0-18 0m9-3h.01" /><Path d="M11 12h1v4h1" /></>);

// v2 closure-body.tsx:78 and tone-disc/index.tsx pair each result with a tinted disc and glyph.
const TONES = {
  ok: { disc: 'bg-success/15', ink: 'text-success', Glyph: CheckGlyph },
  bad: { disc: 'bg-destructive/15', ink: 'text-destructive', Glyph: AlertGlyph },
  muted: { disc: 'bg-muted', ink: 'text-muted-foreground', Glyph: InfoGlyph },
} as const;

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
  const wide = useIsWide();
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
  const tone = blind ? 'muted' : variance < 0 ? 'bad' : 'ok';
  const Glyph = TONES[tone].Glyph;
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
      <DialogContent testID="closure-panel" className={wide ? RIGHT_SHEET : PHONE_PAGE}>
        <DialogHeader testID="closure-panel-header" className="flex-row items-center gap-3 pl-4 pr-11">
          {!wide && <IconButton variant="ghost" className="h-11 w-11" testID="closure-back" accessibilityLabel="Back" onPress={onClose}><ChevronLeftIcon size={18} /></IconButton>}
          <View testID={`closure-tone-${tone}`} className={`size-11 items-center justify-center rounded-full ${TONES[tone].disc}`}>
            <Glyph size={18} strokeWidth={1.5} className={TONES[tone].ink} />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <DialogTitle testID="closure-panel-title" className={SHEET_TITLE}>{`Closure ${closure.number}`}</DialogTitle>
            <DialogDescription testID="closure-panel-description">
              {[storeName, registerName, span].filter(Boolean).join(' · ')}{' · '}
              <Text testID="closure-panel-closer" className="font-semibold text-foreground">{closer}</Text>
            </DialogDescription>
          </View>
        </DialogHeader>
        {wide && <View className="absolute right-1 top-1"><IconButton variant="ghost" className="h-11 w-11" testID="closure-panel-x" accessibilityLabel="Close" onPress={onClose}><XIcon size={18} /></IconButton></View>}
        <ScrollView testID="closure-panel-body" className="min-h-0 flex-1" contentContainerClassName="gap-4 px-4">
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
        <View testID="closure-panel-footer" className={wide ? 'flex-row justify-end gap-2 border-t border-border px-4 pt-4' : 'flex-col gap-2 border-t border-border px-4 pt-4'}>
          {wide && <SheetCloseButton testID="closure-panel-close" onPress={onClose} />}
          <Button testID="closure-reprint" variant="outline" className={wide ? 'h-11 border-border' : 'h-11 w-full border-border'} onPress={() => onReprint(closure)}><Text>Print closure</Text></Button>
        </View>
      </DialogContent>
    </Dialog>
  );
}
