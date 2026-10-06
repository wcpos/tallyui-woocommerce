import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { clampClosureScope, formatClosureDate, selectClosureRows, type Closure, type PosOrder } from '@tallyui/pos';
import { Portal } from '@tallyui/primitives';
import { useSession } from '../lib/auth/session-context';
import { useRegister } from '../lib/register/register-context';
import { dayRange, summarizeSales } from '../lib/reports/today-sales';
import { useOutbox } from '../lib/sale/outbox-context';
import { ordersDatabaseName } from '../lib/sale/order-store';
import { ClosurePrint } from './closure-print';

export function ReportsScreen({ storeName, currency, locale = 'en-US', onBack }: {
  storeName: string; currency: string; locale?: string; onBack(): void;
}) {
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const { session } = useSession();
  const register = useRegister();
  const [range] = useState(() => dayRange(new Date()));
  const [sales, setSales] = useState<PosOrder[]>([]);
  const [rows, setRows] = useState<Closure[]>([]);
  const [reprint, setReprint] = useState<Closure | null>(null);
  const [printRequest, setPrintRequest] = useState(0);
  locale = locale.replaceAll('_', '-');
  const today = formatClosureDate(new Date().toISOString(), { timezone: 'device', locale }).date_ymd;
  const storeKey = session ? ordersDatabaseName(session) : '';
  const closures = selectClosureRows(rows, clampClosureScope({
    from: '0000-01-01', to: today, registerId: register.boundRegisterId ?? '', storeKey,
  }, today), 'device');
  const summary = summarizeSales(sales, currency);
  const money = (amount: number) => formatMoney({ amount, currency }, locale);

  useEffect(() => {
    if (!orders) return;
    const salesSubscription = orders.find({ selector: { createdAt: { $gte: range.startIso, $lt: range.endIso } } }).$
      .subscribe(docs => setSales(docs.map(doc => doc.toMutableJSON())));
    const collection: RxCollection<Closure> = orders.database.collections.closures;
    const closuresSubscription = collection.find().$.subscribe(docs => setRows(docs.map(doc => doc.toMutableJSON())));
    return () => { salesSubscription.unsubscribe(); closuresSubscription.unsubscribe(); };
  }, [orders, range]);

  useEffect(() => {
    if (!reprint) return;
    // Portal publishes to its host in an effect; print after that DOM update.
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
    }, 0);
    return () => clearTimeout(timer);
  }, [reprint?.id, printRequest]);

  return (
    <View className="flex-1 bg-background" dataSet={reprint ? { print: 'hide' } : undefined}>
      <View className="flex-row items-center justify-between p-4">
        <Text accessibilityRole="header">Reports</Text>
        <Button testID="reports-back" onPress={onBack}><Text>Back</Text></Button>
      </View>
      <ScrollView contentContainerClassName="gap-4 p-4">
        <View testID="reports-today" className="gap-2 rounded-lg border border-border p-4">
          <Text accessibilityRole="header">Today</Text>
          <Text>{`Sales today: ${summary.count}`}</Text>
          <Text>{`Total: ${money(summary.totalMinor)}`}</Text>
          {summary.taxMinor !== 0 && <Text>{`Tax: ${money(summary.taxMinor)}`}</Text>}
          {summary.byMethod.map(row => <Text key={row.method}>{`${row.label} — ${row.count} — ${money(row.totalMinor)}`}</Text>)}
          {summary.pending > 0 && <Text>{`Waiting to sync: ${summary.pending}`}</Text>}
          {summary.rejected > 0 && <Text>{`Not accepted by the store: ${summary.rejected}`}</Text>}
          {summary.count === 0 && <Text>No sales yet today.</Text>}
        </View>
        <View testID="reports-closures" className="gap-2 rounded-lg border border-border p-4">
          <Text accessibilityRole="header">Closures</Text>
          {closures.length === 0 && <Text>No closures yet. A closure appears here when a register session closes.</Text>}
          {closures.map(closure => (
            <View key={closure.id} className="gap-2 border-b border-border py-3">
              <Text>{`Closure #${closure.number}`}</Text>
              <Text>{closure.business_day}</Text>
              <Text>{`Closed: ${formatClosureDate(closure.closed_at, { timezone: 'device', locale }).datetime}`}</Text>
              <Text>{`Cash counted: ${money(closure.counted.cash)}`}</Text>
              <Text>{`Variance: ${money(closure.variance.cash)}`}</Text>
              <Text>{`Period sales: ${money(closure.period_sales_total_minor)}`}</Text>
              <Button testID={`closure-reprint-${closure.id}`} onPress={() => { setReprint(closure); setPrintRequest(value => value + 1); }}><Text>Reprint</Text></Button>
            </View>
          ))}
        </View>
      </ScrollView>
      {reprint && <Portal name="closure-reprint">
        <ClosurePrint closure={reprint} storeName={storeName} currency={currency} locale={locale} copy />
      </Portal>}
    </View>
  );
}
