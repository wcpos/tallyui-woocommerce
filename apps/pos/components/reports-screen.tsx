import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Path } from 'react-native-svg';
import { createSvgIcon, IconButton, Text } from '@tallyui/components';
import { useFormatStoreMoney, useStoreMoney } from '../lib/money/store-money';
import {
  formatClosureDate, presetRange, useStoreOrdersInRange, type Closure, type DatePreset, type DayRange, type PosOrder,
} from '@tallyui/pos';
import { Portal } from '@tallyui/primitives';
import { cashierNameFor, deviceCashiers } from '../lib/auth/cashier-name';
import { useSession } from '../lib/auth/session-context';
import { useCatalogue } from '../lib/catalogue/catalogue-context';
import { useRegister } from '../lib/register/register-context';
import { closuresCsv } from '../lib/reports/closures-csv';
import { categoryFigures, productCategoryChoices, productsInCategory } from '../lib/reports/category-figures';
import { productFigures } from '../lib/reports/product-figures';
import { useLeftOut } from '../lib/reports/left-out';
import { closuresScope, periodNow, salesPeriod } from '../lib/reports/report-scope';
import { rangeBounds, salesRoom, salesRoomOf, type Compare } from '../lib/reports/sales-room';
import { storeRoom, useReportContext, type ReportScope } from '../lib/reports/store-read';
import { salesTableCsv } from '../lib/reports/sales-table-csv';
import { cashiersTable, categoriesTable, ordersTable, paymentsTable, productsTable, taxesTable, whereSoldTable } from '../lib/reports/sales-tables';
import { useMinuteClock } from '../lib/reports/use-minute-clock';
import { wholeMoney } from '../lib/reports/whole-money';
import { useOutbox } from '../lib/sale/outbox-context';
import { ordersDatabaseName } from '../lib/sale/order-store';
import { ClosureList, ClosuresExportButton, type ClosureFilter } from './closure-list';
import { ClosurePanel } from './closure-panel';
import { ClosurePrint } from './closure-print';
import { ClosureStats } from './closure-stats';
import { HourlyBars } from './hourly-bars';
import { FolderIcon } from './icons';
import { MenuChip } from './menu-chip';
import { ReportCards, type ReportTable } from './report-cards';
import { CompareChip, LeftOutChip, PrintSummaryButton, ReportChips, reportCashiers } from './report-chips';
import { ReportsHero } from './reports-hero';
import { periodLabel, ReportsPeriod } from './reports-period';
import { SalesSummaryPrint } from './sales-summary-print';
import { SalesTable } from './sales-table';
import { SalesTablePrint } from './sales-table-print';
import { Segmented } from './segmented';
import { SessionCard } from './session-card';
import { TillStrip } from './till-strip';
import { AreaToolbar, useAreaGutter } from './area-header';

// lucide `arrow-left`, v2's `arrowLeft` on `reports-back-sales`.
const ArrowLeftIcon = createSvgIcon('ArrowLeftIcon', () => <><Path d="m12 19-7-7 7-7" /><Path d="M19 12H5" /></>);

// Each room's padding. v2 (reports/index.tsx `ground.p`, page-bar `ground.pt` with no bottom padding) leaves one page
// gutter between the bar and the first card, the gutter at the sides too: 12 px in a window, 16 on a phone
// (ground.ts:46-72, useAreaGutter). The AreaToolbar row above ends in `pb-2` in both layouts (the rail's row, or the
// scope title's row with no rail), so the room's top is `pt-2`: 8 + 8, where `p-4` gave 24. Whole literals.
const ROOM = { 'px-3': 'gap-4 px-3 pb-4 pt-2', 'px-4': 'gap-4 px-4 pb-4 pt-2' } as const;

export function ReportsScreen({ storeName, currency, locale = 'en-US', onBack }: {
  storeName: string; currency: string; locale?: string; onBack(): void;
}) {
  const formatMoney = useFormatStoreMoney();
  const storeMoney = useStoreMoney();
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const { session, cashiers } = useSession();
  const { products: catalogueProducts, catalogue } = useCatalogue();
  const user = session?.tokens.user;
  const register = useRegister();
  // The presets are read from the day the screen opened, as today's range was.
  const [opened] = useState(() => new Date());
  const [period, setPeriod] = useState<DatePreset | DayRange>('today');
  const preset = typeof period === 'string' ? period : undefined;
  const [compare, setCompare] = useState<Compare>('yesterday');
  const [cashierId, setCashierId] = useState<string | null>(null);
  const [scope, setScope] = useState<ReportScope>('store');
  const { leftOut, include: includeOrders, clear: clearLeftOut } = useLeftOut();
  const now = useMinuteClock();
  const [sales, setSales] = useState<PosOrder[]>([]);
  const [rows, setRows] = useState<Closure[]>([]);
  const [reprint, setReprint] = useState<Closure | 'x' | 'summary' | 'table' | null>(null);
  const [openClosureId, setOpenClosureId] = useState<string | null>(null);
  const [openTable, setOpenTable] = useState<ReportTable | null>(null);
  const [productCategory, setProductCategory] = useState('all');
  const [printRequest, setPrintRequest] = useState(0);
  // The chart view is device state for the visit (v2 reports LEDGER 23): not persisted, in no query.
  const [chartView, setChartView] = useState<'hour' | 'run'>('hour');
  // v2 reports/index.tsx `room`: Closures replaces Sales in the same screen; device state for the visit, not persisted.
  const [reportsRoom, setReportsRoom] = useState<'sales' | 'closures'>('sales');
  const [closuresPeriod, setClosuresPeriod] = useState<DatePreset | DayRange>('today');
  const closuresRange = useMemo(() => typeof closuresPeriod === 'string' ? presetRange(closuresPeriod, opened, 'device') : closuresPeriod, [closuresPeriod, opened]);
  const [closuresCashier, setClosuresCashier] = useState<string | null>(null);
  const [closureFilter, setClosureFilter] = useState<ClosureFilter>('all');
  const wide = useWindowDimensions().width >= 600;
  const gutter = useAreaGutter();
  locale = locale.replaceAll('_', '-');
  const { range, multiDay, comparison, bounds, since, weekday, comparisonName, chartName } = useMemo(
    () => salesPeriod(period, compare, opened, locale), [period, compare, opened, locale]);
  const connector = catalogue?.connector;
  const readContext = useReportContext(connector, session);
  // v2 reads every status and filters on the device (context.tsx:174-177); the POS's own orders, created in the range.
  const storeQuery = useMemo(() => scope === 'store'
    ? { createdVia: 'woocommerce-pos', dateRange: { after: since, before: bounds.endIso } } : null, [scope, since, bounds.endIso]);
  const storeRead = useStoreOrdersInRange(connector ?? null, readContext, storeQuery);
  const shown = cashierId === null ? sales : sales.filter(order => order.cashierRef === cashierId);
  const { label, dates } = periodLabel(range, preset ?? 'custom', locale);
  const periodName = label ?? dates;
  const { live, nowKey } = periodNow(range, multiDay, now);
  const today = formatClosureDate(new Date().toISOString(), { timezone: 'device', locale }).date_ymd;
  const storeKey = session ? ordersDatabaseName(session) : '';
  const active = register.enabled && (register.session?.status === 'open' || register.session?.status === 'counting') ? register.session : null;
  const { closures, openSession } = closuresScope(rows, { range: closuresRange, registerId: register.boundRegisterId ?? '',
    storeKey, cashier: closuresCashier, today, active });
  const openClosure = openClosureId ? rows.find(c => c.id === openClosureId) ?? null : null;
  const reprintClosure = (closure: Closure) => { setReprint(closure); setPrintRequest(value => value + 1); };
  const printXReport = () => { setReprint('x'); setPrintRequest(value => value + 1); };
  const printSummary = () => { setReprint('summary'); setPrintRequest(value => value + 1); };
  const printTable = () => { setReprint('table'); setPrintRequest(value => value + 1); };
  const reportCashierRows = reportCashiers([...(user ? [user] : []), ...cashiers.map(entry => entry.tokens.user)]);
  // The register's resolver too (register-context.tsx), so a closure's names match the ones it was stamped with.
  const resolveCashierName = (id: string) => cashierNameFor(deviceCashiers(session, cashiers), id);
  const cashierName = cashierId === null ? 'Everyone' : reportCashierRows.find(row => row.id === cashierId)?.name ?? cashierId;
  // v2 scope.tsx `registerLabel` names the register on every print scope; Tally's reports are this device's sales, so "This till" with none.
  const registerName = register.registerName ?? 'This till';
  const scopeTitle = `${storeName} · ${registerName}`;
  const printDate = (day: string) => formatClosureDate(rangeBounds({ from: day, to: day }).startIso, { timezone: 'device', locale }).date;
  const money = (amount: number) => formatMoney({ amount, currency }, locale);
  // v2 reports/context.tsx:264-288: unticked orders in the period drop out of every figure; the comparison is untouched.
  const ordersView = ordersTable(shown, { range, currency, money, leftOut, cashiers: reportCashierRows });
  const leftOutNow = new Set(ordersView.rows.filter(row => leftOut.has(row.key)).map(row => row.key));
  const counted = leftOutNow.size === 0 ? shown : shown.filter(order => !leftOutNow.has(order.id));
  // PARITY 176/177: under Store, the store's POS orders joined to this till's by clientOrderId, once the whole read
  // lands (store-read.ts); otherwise this till's figures stand under the line. A store order with no copy on this till
  // has no cashier (gap G1), so a chosen cashier counts only this till's orders until the read takes cashierId.
  const store = useMemo(() => scope === 'store' ? storeRoom(storeRead, sales) : { orders: null, line: null }, [scope, storeRead, sales]);
  const storeOrders = store.orders?.filter(order =>
    (cashierId === null || order.cashierRef === cashierId) && !leftOutNow.has(order.key));
  const roomOptions = { now, currency, range, preset, comparison };
  const room = storeOrders ? salesRoomOf(storeOrders, roomOptions) : salesRoom(counted, roomOptions);
  // Products and categories are this till's lines until the store read carries lines (plan PR 4), so their totals,
  // shares and names are this till's too.
  const tillPeriod = storeOrders ? salesRoom(counted, roomOptions).today : room.today;
  // A store order with no copy on this till has no cashier (gap G1), so a chosen cashier's figures are this till's.
  const figuresName = storeOrders && cashierId === null ? storeName : registerName;
  // v2 `reports.panel_scope`: "{period} · {register}", on the table dialog and its printed report.
  const tableScope = `${periodName} · ${openTable === 'orders' || openTable === 'products' || openTable === 'categories' ? registerName : figuresName}`;
  const periodButton = <ReportsPeriod preset={preset ?? 'custom'} range={range} locale={locale} now={opened} onPreset={setPeriod} onCustom={setPeriod} />;
  const chips = <ReportChips cashiers={reportCashierRows} cashierId={cashierId} onCashier={setCashierId}>
    <MenuChip name="scope" value={scope} defaultValue="store"
      choices={[{ value: 'store', label: 'Store' }, { value: 'till', label: 'This till' }]}
      onChange={next => setScope(next as ReportScope)} />
    {leftOutNow.size > 0 && <LeftOutChip count={leftOutNow.size} onOpen={() => setOpenTable('orders')} onClear={clearLeftOut} />}
  </ReportChips>;
  const printButton = <PrintSummaryButton wide={wide} onPress={printSummary} />;
  // The donut centres read whole currency units: the amount rounded to whole units, shown with no decimals.
  const moneyWhole = (minor: number) => wholeMoney(minor, currency, locale, storeMoney);
  // One set of figures feeds each card and its table, so the two never disagree. A refused order is no sale
  // (sales-room.ts); salesRoom keeps `counted` whole, since it counts the refusals for "Not accepted".
  const sold = counted.filter(order => order.syncStatus !== 'rejected');
  const products = productFigures(sold, { currency, range });
  const categories = categoryFigures(sold, catalogueProducts, { currency, range });
  // v2 panel.tsx:78-98: the Products panel's category filter, 'all' until a category is chosen; closing resets it.
  const categoryChoices = productCategoryChoices(products, catalogueProducts);
  const categoryLabel = openTable === 'products' && productCategory !== 'all'
    ? categoryChoices.find(row => row.value === productCategory)?.label ?? productCategory : undefined;
  const panelScope = categoryLabel ? `${tableScope} · ${categoryLabel}` : tableScope;
  const closeTable = () => { setOpenTable(null); setProductCategory('all'); };
  const table = openTable === 'payments' ? paymentsTable(room.today, money)
    : openTable === 'products' ? productsTable(tillPeriod, categoryLabel
      ? productsInCategory(products, catalogueProducts, productCategory) : products, money, !!categoryLabel)
    : openTable === 'categories' ? categoriesTable(tillPeriod, categories, money)
    : openTable === 'cashiers' ? cashiersTable(room.today, reportCashierRows, money)
    : openTable === 'taxes' ? taxesTable(room.today, money)
    : openTable === 'where-sold' ? whereSoldTable(room.today, money)
    : openTable === 'orders' ? ordersView : null;
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
    // From the comparison's first day through the period's last.
    const salesSubscription = orders.find({ selector: { createdAt: { $gte: since, $lt: bounds.endIso } } }).$
      .subscribe(docs => setSales(docs.map(doc => doc.toMutableJSON())));
    const collection: RxCollection<Closure> = orders.database.collections.closures;
    const closuresSubscription = collection.find().$.subscribe(docs => setRows(docs.map(doc => doc.toMutableJSON())));
    return () => { salesSubscription.unsubscribe(); closuresSubscription.unsubscribe(); };
  }, [orders, since, bounds.endIso]);

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
      {/* v2 bar.tsx `Bar`: ManagementBar with the scope title at the row's start and the bell and avatar at its end, in
          both rooms; Closures puts an arrow back to Sales before the title. v2's title is a menu (chevron) choosing the
          store and register; Tally has no store or register directory, so the title is plain text with no menu. */}
      <AreaToolbar area="reports" title="Reports" onBack={onBack} titleSlot={reportsRoom === 'closures'
        ? <View testID="closures-bar" className="min-w-0 shrink flex-row items-center gap-2">
            <IconButton testID="reports-back-sales" variant="ghost" accessibilityLabel="Sales" onPress={() => setReportsRoom('sales')}>
              <ArrowLeftIcon size={20} />
            </IconButton>
            <Text testID="closures-title" numberOfLines={1} className="min-w-0 shrink font-semibold text-foreground">
              {scopeTitle}
            </Text>
          </View>
        : <Text testID="reports-title" numberOfLines={1} className="min-w-0 shrink font-semibold text-foreground">{scopeTitle}</Text>} />
      {reportsRoom === 'closures' ? <>
        <ScrollView testID="reports-closures-room" contentContainerClassName={ROOM[gutter]}>
          {/* v2 reports/index.tsx `renderScopeRow`: the date and the cashier chip, then Export CSV at the right. */}
          <View testID="closures-scope-row" className="flex-row flex-wrap items-center gap-2">
            <View className="shrink-0"><ReportsPeriod preset={typeof closuresPeriod === 'string' ? closuresPeriod : 'custom'} range={closuresRange} locale={locale} now={opened} onPreset={setClosuresPeriod} onCustom={setClosuresPeriod} /></View>
            <View className="min-w-0 flex-1">
              <ReportChips testID="closures-cashier" allLabel="All cashiers" cashiers={reportCashierRows} cashierId={closuresCashier} onCashier={setClosuresCashier} />
            </View>
            {/* v2 `ClosuresExportButton`: the CSV holds closures, so with Open selected there is nothing to export. */}
            <ClosuresExportButton disabled={closureFilter === 'open'}
              onPress={() => downloadCsv(closuresCsv(closures, currency, deviceCashiers(session, cashiers), storeName), `closures-${closuresRange.from}-${closuresRange.to}.csv`)} />
          </View>
          <View testID="reports-closures" className="gap-2">
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
              onOpen={closure => setOpenClosureId(closure.id)}
              filter={closureFilter}
              onFilterChange={setClosureFilter}
            />
          </View>
        </ScrollView>
      </> : <ScrollView testID="reports-sales-room" contentContainerClassName={ROOM[gutter]}>
        <TillStrip orders={orders} currency={currency} locale={locale} resolveCashierName={resolveCashierName}
          onPrintXReport={printXReport} onReprint={reprintClosure} onOpenClosure={closure => setOpenClosureId(closure.id)}
          onOpenClosures={() => setReportsRoom('closures')} />
        {/* v2 `SalesScope` in its `ScopeRow`: wide, the date, the chips, then Print summary; a phone puts the date and
            Print summary on one row above the chips. */}
        {wide
          ? <View testID="reports-scope-strip" className="flex-row items-center gap-2">
              <View className="shrink-0">{periodButton}</View>
              <View className="min-w-0 flex-1">{chips}</View>
              <View className="shrink-0 items-end">{printButton}</View>
            </View>
          : <View testID="reports-scope-strip" className="gap-2">
              <View className="flex-row items-center justify-between gap-2">{periodButton}{printButton}</View>
              {chips}
            </View>}
        <ReportsHero today={room.today} previous={room.yesterdaySoFar} comparisonLabel={`vs ${comparisonName}`}
          money={minor => money(minor) ?? ''} onOpenOrders={() => setOpenTable('orders')}
          compareChip={<CompareChip compare={compare} onCompare={setCompare} weekday={weekday}
            fixed={multiDay ? `vs ${comparisonName}` : undefined} />}
          toggle={room.hours.length > 0 && <View className={wide ? 'w-72' : 'w-full'}>
            <Segmented testID="hero-chart-toggle" label="Chart view" value={chartView}
              segments={[{ value: 'hour', label: multiDay ? 'By day' : 'By hour' }, { value: 'run', label: 'Running total' }]}
              onChange={value => setChartView(value as typeof chartView)} />
          </View>}
          chart={<HourlyBars hours={room.hours} money={minor => money(minor) ?? ''} comparisonName={chartName}
            nowKey={nowKey} live={live} view={chartView} />}>
          {store.line && <Text testID="hero-store-line">{store.line}</Text>}
          {/* A store refund carries no date (gap G3), so it sits on its order's day. */}
          {storeOrders && room.today.refundedMinor > 0 && <Text testID="hero-refunded">{
            `Refunded: ${money(room.today.refundedMinor) ?? ''} · counted on each order's day`}</Text>}
          {room.today.pending > 0 && <Text>{`Waiting to sync: ${room.today.pending}`}</Text>}
          {room.today.rejected > 0 && <Text testID="hero-not-accepted">{`Not accepted by the store: ${room.today.rejected}${
            room.today.rejectedCashMinor > 0 ? ` · ${money(room.today.rejectedCashMinor) ?? ''} cash taken` : ''}`}</Text>}
          {room.today.count === 0 && <Text>{preset === 'today' ? 'No sales yet today.' : 'No sales in this period.'}</Text>}
        </ReportsHero>
        <ReportCards period={room.today} linePeriod={tillPeriod} money={minor => money(minor) ?? ''} moneyWhole={moneyWhole} onOpenTable={setOpenTable} cashiers={reportCashierRows} products={products}
          categories={categories} allLeftOut={ordersView.rows.length > 0 && leftOutNow.size === ordersView.rows.length} />
        {openTable && table && <SalesTable table={table} scope={panelScope} onClose={closeTable} onPrint={printTable}
          filters={openTable === 'products' && categoryChoices.length > 0 && <MenuChip testID="detail-panel-category" name="category"
            icon={FolderIcon} value={productCategory} defaultValue="all" onChange={setProductCategory}
            choices={[{ value: 'all', label: 'All categories' }, ...categoryChoices]} />}
          ticks={openTable === 'orders' ? { leftOut, onInclude: includeOrders } : undefined}
          onExport={() => downloadCsv(salesTableCsv(table), `sales-${openTable}-${range.from}-${range.to}.csv`)} />}
      </ScrollView>}
      {openClosure && <ClosurePanel closure={openClosure} storeName={storeName} currency={currency} locale={locale} blind={register.blind} resolveCashierName={resolveCashierName} onReprint={reprintClosure} onClose={() => setOpenClosureId(null)} />}
      {reprint && <Portal name="closure-reprint">
        {reprint === 'table'
          ? table && <SalesTablePrint table={table} storeName={storeName} scope={panelScope} locale={locale} />
          : reprint === 'summary'
          ? <SalesSummaryPrint storeName={storeName} scope={`${periodName} · ${figuresName} · ${cashierName}`} period={room.today}
              date={range.from === range.to ? printDate(range.from) : `${printDate(range.from)} – ${printDate(range.to)}`} money={minor => money(minor) ?? ''} locale={locale} cashierName={resolveCashierName} />
          : reprint === 'x'
          ? register.session && <ClosurePrint kind="x" closure={register.session} expected={register.expected} storeName={storeName} currency={currency} locale={locale} registerName={registerName} resolveCashierName={resolveCashierName} />
          : <ClosurePrint closure={reprint} storeName={storeName} currency={currency} locale={locale} registerName={registerName} resolveCashierName={resolveCashierName} copy />}
      </Portal>}
    </View>
  );
}
