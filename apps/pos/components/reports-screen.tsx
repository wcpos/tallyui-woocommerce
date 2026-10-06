import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { clampClosureScope, formatClosureDate, selectClosureRows, type Closure, type PosOrder } from '@tallyui/pos';
import { Portal } from '@tallyui/primitives';
import { useSession } from '../lib/auth/session-context';
import { useRegister } from '../lib/register/register-context';
import { closuresCsv } from '../lib/reports/closures-csv';
import { salesRoom } from '../lib/reports/sales-room';
import { ordersTable, paymentsTable, taxesTable } from '../lib/reports/sales-tables';
import { dayRange } from '../lib/reports/today-sales';
import { useOutbox } from '../lib/sale/outbox-context';
import { ordersDatabaseName } from '../lib/sale/order-store';
import { ClosurePrint } from './closure-print';
import { HourlyBars } from './hourly-bars';
import { SalesTable } from './sales-table';

export function ReportsScreen({ storeName, currency, locale = 'en-US', onBack }: {
  storeName: string; currency: string; locale?: string; onBack(): void;
}) {
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const { session } = useSession();
  const user = session?.tokens.user;
  const resolveCashierName = (id: string) => user && id === String(user.id) ? user.displayName : id;
  const register = useRegister();
  const [range] = useState(() => dayRange(new Date()));
  const [yesterday] = useState(() => {
    const now = new Date(range.startIso);
    const [y, m, d] = [now.getFullYear(), now.getMonth(), now.getDate()];
    return dayRange(new Date(y, m, d - 1));
  });
  const [sales, setSales] = useState<PosOrder[]>([]);
  const [rows, setRows] = useState<Closure[]>([]);
  const [reprint, setReprint] = useState<Closure | 'x' | null>(null);
  const [openTable, setOpenTable] = useState<'payments' | 'taxes' | 'orders' | null>(null);
  const [printRequest, setPrintRequest] = useState(0);
  locale = locale.replaceAll('_', '-');
  const today = formatClosureDate(new Date().toISOString(), { timezone: 'device', locale }).date_ymd;
  const storeKey = session ? ordersDatabaseName(session) : '';
  const closures = selectClosureRows(rows, clampClosureScope({
    from: '0000-01-01', to: today, registerId: register.boundRegisterId ?? '', storeKey,
  }, today), 'device');
  const room = salesRoom(sales, { now: new Date(), currency });
  const { yesterdaySoFar, delta } = room;
  const money = (amount: number) => formatMoney({ amount, currency }, locale);
  const signedMoney = (n: number) => n > 0 ? '+' + money(n) : n < 0 ? '−' + money(-n) : money(0);
  const signedCount = (n: number) => n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
  const percent = delta.percentTenths === null ? '—'
    : `${delta.percentTenths > 0 ? '+' : delta.percentTenths < 0 ? '−' : ''}${(Math.abs(delta.percentTenths) / 10).toFixed(1)}%`;
  const downloadCsv = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const csv = closuresCsv(closures, currency, session?.tokens.user, storeName);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `closures-${today}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!orders) return;
    const salesSubscription = orders.find({ selector: { createdAt: { $gte: yesterday.startIso, $lt: range.endIso } } }).$
      .subscribe(docs => setSales(docs.map(doc => doc.toMutableJSON())));
    const collection: RxCollection<Closure> = orders.database.collections.closures;
    const closuresSubscription = collection.find().$.subscribe(docs => setRows(docs.map(doc => doc.toMutableJSON())));
    return () => { salesSubscription.unsubscribe(); closuresSubscription.unsubscribe(); };
  }, [orders, range, yesterday]);

  useEffect(() => {
    if (!reprint) return;
    // Portal publishes to its host in an effect; print after that DOM update.
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') window.print();
    }, 0);
    return () => clearTimeout(timer);
  }, [reprint, printRequest]);

  return (
    <View className="flex-1 bg-background" dataSet={reprint ? { print: 'hide' } : undefined}>
      <View className="flex-row items-center justify-between p-4">
        <Text accessibilityRole="header">Reports</Text>
        <Button testID="reports-back" onPress={onBack}><Text>Back</Text></Button>
      </View>
      <ScrollView contentContainerClassName="gap-4 p-4">
        {register.session?.status === 'open' && <Button testID="x-report-print" onPress={() => { setReprint('x'); setPrintRequest(value => value + 1); }}><Text>Print X report</Text></Button>}
        <View testID="reports-today" className="gap-2 rounded-lg border border-border p-4">
          <Text accessibilityRole="header">Today</Text>
          <Text>{`Total: ${money(room.today.totalMinor)}`}</Text>
          <Text>{`Yesterday by now: ${money(yesterdaySoFar.totalMinor)}`}</Text>
          <Text className={delta.totalMinor < 0 ? 'text-destructive' : delta.totalMinor === 0 ? 'text-muted-foreground' : undefined}>
            {`Change: ${signedMoney(delta.totalMinor)} · ${percent}`}
          </Text>
          <Pressable testID="sales-room-orders-open" accessibilityRole="button" accessibilityLabel="Open Orders table" onPress={() => setOpenTable('orders')}>
            <Text>{`Orders: ${room.today.count} (${signedCount(delta.count)})`}</Text>
          </Pressable>
          <Text>{`Average order: ${money(room.today.averageMinor)} (${signedMoney(delta.averageMinor)})`}</Text>
          {room.today.pending > 0 && <Text>{`Waiting to sync: ${room.today.pending}`}</Text>}
          {room.today.rejected > 0 && <Text>{`Not accepted by the store: ${room.today.rejected}`}</Text>}
          {room.today.count === 0 && <Text>No sales yet today.</Text>}
        </View>
        <HourlyBars hours={room.hours} currency={currency} locale={locale} />
        {room.today.byMethod.length > 0 && <View testID="sales-room-payments" className="gap-2 rounded-lg border border-border p-4">
          <Pressable testID="sales-room-payments-open" accessibilityRole="button" accessibilityLabel="Open Payments table" onPress={() => setOpenTable('payments')}>
            <Text accessibilityRole="header">Payments ›</Text>
          </Pressable>
          {room.today.byMethod.map(row => <Text key={row.method}>{`${row.label} · ${row.count} ${row.count === 1 ? 'order' : 'orders'} · ${money(row.totalMinor)}`}</Text>)}
          {room.today.splitCount > 0 && <Text>{`Split tenders: ${room.today.splitCount}`}</Text>}
        </View>}
        {room.today.taxMinor !== 0 && <View testID="sales-room-taxes" className="gap-2 rounded-lg border border-border p-4">
          <Pressable testID="sales-room-taxes-open" accessibilityRole="button" accessibilityLabel="Open Taxes table" onPress={() => setOpenTable('taxes')}>
            <Text accessibilityRole="header">Taxes ›</Text>
          </Pressable>
          {room.today.taxRates.map(row => <Text key={row.ratePpm}>{`${row.label} — Net ${money(row.netMinor)} — Tax ${money(row.taxMinor)} — Gross ${money(row.grossMinor)}`}</Text>)}
        </View>}
        {openTable && <SalesTable table={openTable === 'payments' ? paymentsTable(room.today, money)
          : openTable === 'taxes' ? taxesTable(room.today, money)
          : ordersTable(sales, { now: new Date(), currency, money })} scope="Today · This till" onClose={() => setOpenTable(null)} />}
        <View testID="reports-closures" className="gap-2 rounded-lg border border-border p-4">
          <View className="flex-row items-center justify-between">
            <Text accessibilityRole="header">Closures</Text>
            {closures.length > 0 && <Button testID="closures-csv" onPress={downloadCsv}><Text>Download CSV</Text></Button>}
          </View>
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
        {reprint === 'x'
          ? register.session && <ClosurePrint kind="x" closure={register.session} expected={register.expected} storeName={storeName} currency={currency} locale={locale} registerName="This till" resolveCashierName={resolveCashierName} />
          : <ClosurePrint closure={reprint} storeName={storeName} currency={currency} locale={locale} registerName="This till" resolveCashierName={resolveCashierName} copy />}
      </Portal>}
    </View>
  );
}
