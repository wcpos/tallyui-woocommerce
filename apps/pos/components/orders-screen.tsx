import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Loader, OrderFilterBar, Receipt, SearchInput, Text, type OrderHistoryRow } from '@tallyui/components';
import { type StoreOrder } from '@tallyui/core';
import { useFormatStoreMoney } from '../lib/money/store-money';
import { StoreMoneyFor } from '../lib/money/store-money-for';
import { buildReceiptDataFromPosOrder, buildReceiptDataFromStoreOrder, orderFiltersQuery, type PosOrder, type ReceiptConfig } from '@tallyui/pos';
import { useOutbox } from '../lib/sale/outbox-context';
import { useRegister } from '../lib/register/register-context';
import { REGISTER_ID } from '../lib/register/register-id';
import { initialOrderFilters, matchesOrderFilters, matchesOrderSearch, toHistoryRow, WOO_CREATED_VIA_OPTIONS, WOO_STATUS_LABELS, type OrderHistorySource } from '../lib/orders/order-history';
import { areaDisplayShown, useAreaColumns } from '../lib/area-columns';
import { useSearchTerm } from '../lib/search-term';
import { ORDERS_COLUMNS, OrdersTable } from './orders-table';
import { AreaDisplayOptions } from './area-display-options';
import { EmptyState } from './empty-state';
import { OrderDetailSheet, orderPaymentState } from './order-detail';
import { ReceiptCopyLine } from './receipt-identity';
import { ReceiptPrintSheet } from './receipt-print-sheet';
import { ReceiptStoreLine } from './receipt-store-line';
import { ReceiptSyncOrder } from './receipt-sync-order';
import { ReceiptZoom } from './receipt-zoom';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { useReceiptPrintCount } from '../lib/receipts/use-receipt-print-count';
import { AreaToolbar, useAreaGutter } from './area-header';
import { RefusedOrdersNotice } from './refused-orders-notice';
import { toast } from '../lib/toast/toast';

// The app has no store timezone yet (lib/orders/order-days.ts)
const TIMEZONE = 'device';
// v2's orders.refresh_failed (core.json:975), toasted as a warning by order-actions.tsx:57-79.
export const ORDER_REFRESH_FAILED = "Couldn't refresh this order. The copy on this device is unchanged — check your connection and try again.";

export function OrdersScreen({ onBack, history, storeName, cashierName, cashierId, onCustomerSearch, onReview }: {
  onBack(): void; history: OrderHistorySource | null; storeName: string; cashierName: string;
  cashierId?: string;
  onCustomerSearch?(text: string): Promise<Array<{ id: string; name: string }>>;
  onReview?(): void;
}) {
  const outbox = useOutbox();
  const register = useRegister();
  const fields = history?.fields ?? [];
  const initial = useMemo(() => initialOrderFilters(fields, cashierId), [fields, cashierId]);
  const [value, setValue] = useState(initial);
  const [found, setFound] = useState<Array<{ value: string; label: string }>>([]);
  const customerRequest = useRef(0);
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(history !== null);
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState<{ data: ReturnType<typeof buildReceiptDataFromPosOrder>; posOrder?: PosOrder; storeOrder?: StoreOrder } | null>(null);
  const [viewing, setViewing] = useState<StoreOrder | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { term, query: search, type, set } = useSearchTerm();
  const [columns, setColumns] = useAreaColumns('orders', ORDERS_COLUMNS);
  // v2's page gutter (ground.ts:46-72): the bar, the table card (OrdersTable) and this page's notes; the receipt keeps 16.
  const gutter = useAreaGutter();
  const request = useRef(0);
  // v2 counts prints, not opens (use-receipt-data.ts:108-109): the receipt is a copy only once printed, as the sale's COPY n.
  const receiptId = opened ? opened.posOrder?.id ?? opened.data.header.orderNumber : null;
  const copies = useReceiptPrintCount(receiptId);
  // TallyUI's top Reprint line stays off: the app's copy line, in the footer, carries it after the totals as v2's does.
  const receipt = opened && { ...opened.data, fiscal: { ...opened.data.fiscal, is_reprint: false, reprint_count: 0 } };
  const liveOpened = opened?.posOrder && ((outbox.enabled && outbox.recent.find(o => o.id === opened.posOrder!.id)) || opened.posOrder);

  async function loadPage(nextPage: number, query: string) {
    const mine = ++request.current;
    if (nextPage === 1) {
      setOrders([]);
      setHasMore(false);
      setTotal(null);
      setPage(0);
    }
    setLoading(true);
    setFailed(false);
    try {
      const result = await (fields.length > 0 ? history!.list(nextPage, query || undefined, orderFiltersQuery(value, TIMEZONE))
        : query ? history!.list(nextPage, query) : history!.list(nextPage));
      if (mine !== request.current) return;
      setOrders(current => [...new Map([...current, ...result.orders].map(order => [order.id, order])).values()]);
      setHasMore(result.hasMore);
      setTotal(result.total ?? null);
      setPage(nextPage);
    } catch {
      if (mine !== request.current) return;
      setFailed(true);
    } finally {
      if (mine === request.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (outbox.enabled && history) void loadPage(1, search);
  }, [outbox.enabled, history, search, value]);

  function scan(code: string) { if (outbox.enabled && opened === null && viewing === null) set(code); }
  // Orders keeps the claim while a receipt or detail is open, so the till underneath does not ring the scan up.
  useWedgeScanner(scan, true);

  function clear() { set(''); setValue(initial); }

  // v2's Sync (order-actions.tsx:57-79): re-read this one order and redraw the sheet and its row; a failure keeps both.
  async function sync(id: string) {
    setSyncing(true);
    try {
      const fresh = await history!.get!(id);
      if (!fresh) throw new Error('The store has no such order');
      setOrders(current => current.map(order => order.id === id ? fresh : order));
      setViewing(current => current?.id === id ? fresh : current);
    } catch { toast({ type: 'warning', title: ORDER_REFRESH_FAILED }); }
    finally { setSyncing(false); }
  }

  function open(row: PosOrder | OrderHistoryRow) {
    const config: ReceiptConfig = { storeName, cashier: cashierName, register: REGISTER_ID,
      registerName: register?.registerName ?? undefined };
    if ('placedAt' in row) {
      const storeOrder = orders.find(order => order.id === row.id)!;
      setOpened({ data: buildReceiptDataFromStoreOrder(storeOrder, config), storeOrder });
    } else setOpened({ data: buildReceiptDataFromPosOrder(row, config), posOrder: row });
  }

  const local = outbox.enabled ? outbox.recent.filter(order => matchesOrderSearch(order, search) && matchesOrderFilters(order, value, cashierId, TIMEZONE)) : [];
  const filtered = (['status', 'customerId', 'cashierId', 'registerId', 'paymentMethod', 'storeId', 'createdVia'] as const)
    .some(key => value[key] !== initial[key]) || value.dateRange?.from !== initial.dateRange?.from || value.dateRange?.to !== initial.dateRange?.to;
  const footer = history ? <>
    {/* v2's list footer (data-table/list-footer.tsx): a centred Loader under the last row while a page loads. */}
    {loading && page > 0 && <View testID="orders-page-spinner" className="items-center justify-center bg-card p-2"><Loader /></View>}
    {failed && <>
      <Text>Store orders couldn't be loaded.</Text>
      <Button testID="orders-history-retry" disabled={loading} onPress={() => { void loadPage(page + 1, search); }}><Text>Try again</Text></Button>
    </>}
  </> : undefined;
  return (
    <View className="flex-1 bg-background">
      <AreaToolbar area="orders" title="Orders" onBack={onBack}
        search={outbox.enabled && !opened && !viewing ? <SearchInput testID="search-orders" value={term} onChangeText={type} placeholder="Search Orders" /> : null}>
        <AreaDisplayOptions area="orders" columns={ORDERS_COLUMNS} settings={columns} onChange={setColumns} />
      </AreaToolbar>
      {outbox.enabled && !opened && !viewing && <RefusedOrdersNotice className={`pb-3 ${gutter}`} orders={outbox.orders} onOpen={open} onReview={onReview} />}
      {outbox.enabled && history && fields.length > 0 && !opened && !viewing && <View className={`pb-3 ${gutter}`}>
        <ScrollView testID="orders-chip-row" horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerClassName="items-center gap-2">
          <OrderFilterBar value={value} onChange={setValue} fields={fields} initial={initial} timezone={TIMEZONE}
            options={{ status: Object.entries(WOO_STATUS_LABELS).map(([value, label]) => ({ value, label })),
              customer: [{ value: '0', label: 'Guest' }, ...found],
              cashier: cashierId !== undefined ? [{ value: cashierId, label: cashierName }] : [], createdVia: WOO_CREATED_VIA_OPTIONS }}
            onCustomerSearch={onCustomerSearch ? async text => {
              const mine = ++customerRequest.current;
              try {
                const customers = await onCustomerSearch(text);
                if (mine === customerRequest.current) setFound(customers.map(({ id, name }) => ({ value: id, label: name })));
              } catch { /* Keep the last list. */ }
            } : undefined} />
        </ScrollView>
      </View>}
      {outbox.enabled
        ? opened
          ? <View className="min-h-0 flex-1 px-4 pb-4">{opened.storeOrder && <NotPaidLine order={opened.storeOrder} />}
            {/* The order's own currency: the store's format only when it is the store's (a USD order on a EUR store reads $12.50). */}
            <StoreMoneyFor currency={opened.data.currency}><ReceiptZoom><ReceiptPrintSheet orderId={opened.posOrder?.id ?? opened.data.header.orderNumber}>
            {/* The live copy: a sale that reaches the store while its receipt is open loses the line. */}
            <ReceiptStoreLine posOrder={liveOpened} />
            <Receipt receipt={receipt!} posOrder={opened.posOrder} newSale={() => setOpened(null)} doneLabel="Back"
              footerSlot={copies > 0 ? <ReceiptCopyLine count={copies} /> : undefined} /></ReceiptPrintSheet></ReceiptZoom></StoreMoneyFor>
            <ReceiptSyncOrder posOrder={liveOpened} onRequeue={ids => (outbox.enabled ? outbox.requeue(ids) : Promise.resolve(0))} /></View>
          : local.length === 0 && orders.length === 0 && !failed && !loading
            ? search !== '' || filtered
              ? <EmptyState kind="no-results" title="No orders match these filters" action={{ label: 'Clear filters', onPress: clear }} />
              : <EmptyState kind="empty" title="No orders yet" description="Sales you take will appear here." />
            : <OrdersTable local={local} store={orders} footer={footer} active={loading} total={total}
              placeholder={loading && local.length === 0 && orders.length === 0}
              // v2's guard (useGuardedExtendLimit): none while a page loads, when exhausted, or after a failure until Try again.
              onEndReached={() => { if (hasMore && !loading && !failed) void loadPage(page + 1, search); }}
              visible={columns.filter(column => column.visible).map(column => column.id)}
              showPayment={areaDisplayShown(columns, 'total', 'payment_method')}
              onSync={history ? () => { void loadPage(1, search); } : undefined}
              // v2's cell taps (status-filter-cell.tsx:29, order/customer.tsx:39) set the bar's filter, so only where it shows.
              onFilterStatus={fields.length > 0 ? status => setValue(v => ({ ...v, status })) : undefined}
              onFilterCustomer={fields.length > 0 ? (id, name) => {
                setValue(v => ({ ...v, customerId: id }));
                // The Customer chip names the customer from its options.
                if (id !== '0') setFound(list => list.some(o => o.value === id) ? list : [...list, { value: id, label: name }]);
              } : undefined}
              onOpen={row => { if (row.kind === 'store') setViewing(row.order); else open(row.order); }} />
        : <View testID="orders-unavailable" className={`py-4 ${gutter}`}><Text>Orders show once the store is connected.</Text></View>}
      {outbox.enabled && viewing && !opened && <OrderDetailSheet order={viewing} onReceipt={() => open(toHistoryRow(viewing))} onClose={() => setViewing(null)}
        onSync={history?.get ? () => { void sync(viewing.id); } : undefined} syncing={syncing} />}
    </View>
  );
}

// v2's receipt mark (receipt/receipt.tsx:75): a live order the store does not count as paid says what is due, in the
// sheet's description above the receipt, unprinted. The rule is the order view's (orderPaymentState). The till's own
// sales are paid at tender and never get it: only a store order passes one.
function NotPaidLine({ order }: { order: StoreOrder }) {
  const formatMoney = useFormatStoreMoney();
  const { owing, remainingMinor } = orderPaymentState(order);
  if (!owing) return null;
  const money = formatMoney({ amount: remainingMinor, currency: order.currency }) ?? String(remainingMinor);
  return <Text testID="receipt-not-paid" className="pb-2 text-sm text-warning-text">{`Not paid · ${money} due`}</Text>;
}
