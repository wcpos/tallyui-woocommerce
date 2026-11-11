import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Text } from '@tallyui/components';
import { formatMoney } from '@tallyui/core';
import { clampClosureScope, formatClosureDate, selectClosureRows, type Closure, type PosOrder } from '@tallyui/pos';
import { Portal } from '@tallyui/primitives';
import { useSession } from '../lib/auth/session-context';
import { useRegister } from '../lib/register/register-context';
import { closuresCsv } from '../lib/reports/closures-csv';
import { salesRoom, type Compare } from '../lib/reports/sales-room';
import { salesTableCsv } from '../lib/reports/sales-table-csv';
import { ordersTable, paymentsTable, taxesTable } from '../lib/reports/sales-tables';
import { dayRange } from '../lib/reports/today-sales';
import { useMinuteClock } from '../lib/reports/use-minute-clock';
import { useOutbox } from '../lib/sale/outbox-context';
import { ordersDatabaseName } from '../lib/sale/order-store';
import { ClosureList } from './closure-list';
import { ClosurePanel } from './closure-panel';
import { ClosurePrint } from './closure-print';
import { ClosureStats } from './closure-stats';
import { HourlyBars } from './hourly-bars';
import { ReportCards } from './report-cards';
import { CompareChip, PrintSummaryButton, ReportChips, reportCashiers } from './report-chips';
import { ReportsHero } from './reports-hero';
import { SalesSummaryPrint } from './sales-summary-print';
import { SalesTable } from './sales-table';
import { Segmented } from './segmented';
import { SessionCard } from './session-card';
import { TillStrip } from './till-strip';
import { AreaHeader } from './area-header';

export function ReportsScreen({ storeName, currency, locale = 'en-US', onBack }: {
  storeName: string; currency: string; locale?: string; onBack(): void;
}) {
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const { session, cashiers } = useSession();
  const user = session?.tokens.user;
  const resolveCashierName = (id: string) => user && id === String(user.id) ? user.displayName : id;
  const register = useRegister();
  const [range] = useState(() => dayRange(new Date()));
  const [weekBefore] = useState(() => {
    const start = new Date(range.startIso);
    return dayRange(new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7));
  });
  const [compare, setCompare] = useState<Compare>('yesterday');
  const [cashierId, setCashierId] = useState<string | null>(null);
  const now = useMinuteClock();
  const [sales, setSales] = useState<PosOrder[]>([]);
  const [rows, setRows] = useState<Closure[]>([]);
  const [reprint, setReprint] = useState<Closure | 'x' | 'summary' | null>(null);
  const [openClosureId, setOpenClosureId] = useState<string | null>(null);
  const [openTable, setOpenTable] = useState<'payments' | 'taxes' | 'orders' | null>(null);
  const [printRequest, setPrintRequest] = useState(0);
  // The chart view is device state for the visit (v2 reports LEDGER 23): not persisted, in no query.
  const [chartView, setChartView] = useState<'hour' | 'run'>('hour');
  const wide = useWindowDimensions().width >= 600;
  locale = locale.replaceAll('_', '-');
  const shown = cashierId === null ? sales : sales.filter(order => order.cashierRef === cashierId);
  const weekday = new Date(range.startIso).toLocaleDateString(locale, { weekday: 'long' });
  const comparisonName = compare === 'yesterday' ? 'yesterday' : `last ${weekday}`;
  const today = formatClosureDate(new Date().toISOString(), { timezone: 'device', locale }).date_ymd;
  const storeKey = session ? ordersDatabaseName(session) : '';
  const closures = selectClosureRows(rows, clampClosureScope({
    from: '0000-01-01', to: today, registerId: register.boundRegisterId ?? '', storeKey,
  }, today), 'device');
  const openSession = register.enabled && (register.session?.status === 'open' || register.session?.status === 'counting') ? register.session : null;
  const openClosure = openClosureId ? closures.find(c => c.id === openClosureId) ?? null : null;
  const reprintClosure = (closure: Closure) => { setReprint(closure); setPrintRequest(value => value + 1); };
  const printXReport = () => { setReprint('x'); setPrintRequest(value => value + 1); };
  const printSummary = () => { setReprint('summary'); setPrintRequest(value => value + 1); };
  const reportCashierRows = reportCashiers([...(user ? [user] : []), ...cashiers.map(entry => entry.tokens.user)]);
  const cashierName = cashierId === null ? 'Everyone' : reportCashierRows.find(row => row.id === cashierId)?.name ?? cashierId;
  const room = salesRoom(shown, { now, currency, compare });
  const money = (amount: number) => formatMoney({ amount, currency }, locale);
  // The donut centres read whole currency units: the amount rounded to whole units, shown with no decimals.
  const exponent = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const moneyWhole = (minor: number) => new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(minor / 10 ** exponent));
  const table = openTable === 'payments' ? paymentsTable(room.today, money)
    : openTable === 'taxes' ? taxesTable(room.today, money)
    : openTable === 'orders' ? ordersTable(shown, { now, currency, money }) : null;
  const downloadCsv = (csv: string, filename: string) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!orders) return;
    const salesSubscription = orders.find({ selector: { createdAt: { $gte: weekBefore.startIso, $lt: range.endIso } } }).$
      .subscribe(docs => setSales(docs.map(doc => doc.toMutableJSON())));
    const collection: RxCollection<Closure> = orders.database.collections.closures;
    const closuresSubscription = collection.find().$.subscribe(docs => setRows(docs.map(doc => doc.toMutableJSON())));
    return () => { salesSubscription.unsubscribe(); closuresSubscription.unsubscribe(); };
  }, [orders, range, weekBefore]);

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
      <AreaHeader title="Reports" backTestID="reports-back" onBack={onBack} gap={false} />
      <ScrollView contentContainerClassName="gap-4 p-4">
        <TillStrip orders={orders} currency={currency} locale={locale} resolveCashierName={resolveCashierName}
          onPrintXReport={printXReport} onReprint={reprintClosure} onOpenClosure={closure => setOpenClosureId(closure.id)} />
        {/* v2 `SalesScope`: the chips left, Print summary right. The date menu comes in slice 2. */}
        <View testID="reports-scope-strip" className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <ReportChips cashiers={reportCashierRows} cashierId={cashierId} onCashier={setCashierId} />
          </View>
          <View className="shrink-0 items-end"><PrintSummaryButton wide={wide} onPress={printSummary} /></View>
        </View>
        <ReportsHero today={room.today} previous={room.yesterdaySoFar} comparisonLabel={`vs ${comparisonName}`}
          money={minor => money(minor) ?? ''} onOpenOrders={() => setOpenTable('orders')}
          compareChip={<CompareChip compare={compare} onCompare={setCompare} weekday={weekday} />}
          toggle={room.hours.length > 0 && <View className={wide ? 'w-72' : 'w-full'}>
            <Segmented testID="hero-chart-toggle" label="Chart view" value={chartView}
              segments={[{ value: 'hour', label: 'By hour' }, { value: 'run', label: 'Running total' }]}
              onChange={value => setChartView(value as typeof chartView)} />
          </View>}
          chart={<HourlyBars hours={room.hours} money={minor => money(minor) ?? ''} comparisonName={comparisonName}
            nowHour={now.getHours()} view={chartView} />}>
          {room.today.pending > 0 && <Text>{`Waiting to sync: ${room.today.pending}`}</Text>}
          {room.today.rejected > 0 && <Text>{`Not accepted by the store: ${room.today.rejected}`}</Text>}
          {room.today.count === 0 && <Text>No sales yet today.</Text>}
        </ReportsHero>
        <ReportCards period={room.today} money={minor => money(minor) ?? ''} moneyWhole={moneyWhole} onOpenTable={setOpenTable} />
        {room.today.taxMinor !== 0 && <View testID="sales-room-taxes" className="gap-2 rounded-lg border border-border p-4">
          <Pressable testID="sales-room-taxes-open" accessibilityRole="button" accessibilityLabel="Open Taxes table" onPress={() => setOpenTable('taxes')}>
            <Text accessibilityRole="header">Taxes ›</Text>
          </Pressable>
          {room.today.taxRates.map(row => <Text key={row.ratePpm}>{`${row.label} — Net ${money(row.netMinor)} — Tax ${money(row.taxMinor)} — Gross ${money(row.grossMinor)}`}</Text>)}
        </View>}
        {openTable && table && <SalesTable table={table} scope="Today · This till" onClose={() => setOpenTable(null)}
          onExport={() => downloadCsv(salesTableCsv(table), `sales-${openTable}-${today}-${today}.csv`)} />}
        <View testID="reports-closures" className="gap-2 rounded-lg border border-border p-4">
          <View className="flex-row items-center justify-between">
            <Text accessibilityRole="header">Closures</Text>
            {closures.length > 0 && <Button testID="closures-csv" variant="outline" onPress={() => downloadCsv(closuresCsv(closures, currency, session?.tokens.user, storeName), `closures-${today}.csv`)}><Text>Export CSV</Text></Button>}
          </View>
          {/* v2 feeds the strip every row and open session, whatever the All / Open / Closed tab shows. */}
          <ClosureStats rows={closures} openSession={openSession} blind={register.blind} currency={currency} locale={locale} />
          <ClosureList
            rows={closures}
            sessionRows={<SessionCard currency={currency} locale={locale} resolveCashierName={resolveCashierName} onPrintXReport={printXReport} />}
            openSessions={openSession ? 1 : 0}
            blind={register.blind}
            today={today}
            currency={currency}
            locale={locale}
            resolveCashierName={resolveCashierName}
            onReprint={reprintClosure}
            onOpen={closure => setOpenClosureId(closure.id)}
          />
        </View>
        {openClosure && <ClosurePanel closure={openClosure} storeName={storeName} currency={currency} locale={locale} blind={register.blind} resolveCashierName={resolveCashierName} onReprint={reprintClosure} onClose={() => setOpenClosureId(null)} />}
      </ScrollView>
      {reprint && <Portal name="closure-reprint">
        {reprint === 'summary'
          ? <SalesSummaryPrint storeName={storeName} scope={`Today · This till · ${cashierName}`} period={room.today}
              date={formatClosureDate(range.startIso, { timezone: 'device', locale }).date} money={minor => money(minor) ?? ''} locale={locale} />
          : reprint === 'x'
          ? register.session && <ClosurePrint kind="x" closure={register.session} expected={register.expected} storeName={storeName} currency={currency} locale={locale} registerName="This till" resolveCashierName={resolveCashierName} />
          : <ClosurePrint closure={reprint} storeName={storeName} currency={currency} locale={locale} registerName="This till" resolveCashierName={resolveCashierName} copy />}
      </Portal>}
    </View>
  );
}
