import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, OrderFilterBar, Receipt, SearchInput, Text, type OrderHistoryRow } from '@tallyui/components';
import type { StoreOrder } from '@tallyui/core';
import { buildReceiptDataFromPosOrder, buildReceiptDataFromStoreOrder, orderFiltersQuery, type PosOrder, type ReceiptConfig } from '@tallyui/pos';
import { useOutbox } from '../lib/sale/outbox-context';
import { useRegister } from '../lib/register/register-context';
import { initialOrderFilters, matchesOrderFilters, matchesOrderSearch, toHistoryRow, WOO_CREATED_VIA_OPTIONS, WOO_STATUS_LABELS, type OrderHistorySource } from '../lib/orders/order-history';
import { useAreaColumns } from '../lib/area-columns';
import { ORDERS_COLUMNS, OrdersTable } from './orders-table';
import { AreaDisplayOptions } from './area-display-options';
import { OrderDetailSheet } from './order-detail';
import { ReceiptPrintSheet } from './receipt-print-sheet';
import { ReceiptZoom } from './receipt-zoom';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { AreaToolbar, useAreaGutter } from './area-header';

// The till id; the bound register is the drawer.
const REGISTER_ID = 'web';
// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;
// The app has no store timezone yet (lib/orders/order-days.ts)
const TIMEZONE = 'device';

export function OrdersScreen({ onBack, history, storeName, cashierName, cashierId, onCustomerSearch }: {
  onBack(): void; history: OrderHistorySource | null; storeName: string; cashierName: string;
  cashierId?: string;
  onCustomerSearch?(text: string): Promise<Array<{ id: string; name: string }>>;
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
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(history !== null);
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState<{ data: ReturnType<typeof buildReceiptDataFromPosOrder>; posOrder?: PosOrder } | null>(null);
  const [viewing, setViewing] = useState<StoreOrder | null>(null);
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [columns, setColumns] = useAreaColumns('orders', ORDERS_COLUMNS);
  // v2's page gutter (ground.ts:46-72): the bar, the table card (OrdersTable) and this page's notes; the receipt keeps 16.
  const gutter = useAreaGutter();
  const request = useRef(0);
  // The count is in memory only, for each order opened in this screen.
  const counts = useRef(new Map<string, number>());

  useEffect(() => {
    const timer = setTimeout(() => setSearch(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term]);

  async function loadPage(nextPage: number, query: string) {
    const mine = ++request.current;
    if (nextPage === 1) {
      setOrders([]);
      setHasMore(false);
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

  function scan(code: string) { setTerm(code); setSearch(code.trim()); }
  useWedgeScanner(scan, outbox.enabled && opened === null && viewing === null);

  function clear() { setTerm(''); setSearch(''); setValue(initial); }

  function open(row: PosOrder | OrderHistoryRow) {
    const n = (counts.current.get(row.id) ?? 0) + 1;
    counts.current.set(row.id, n);
    const config: ReceiptConfig = { storeName, cashier: cashierName, register: REGISTER_ID,
      registerName: register?.registerName ?? undefined, fiscal: { reprint_count: n } };
    setOpened('placedAt' in row
      ? { data: buildReceiptDataFromStoreOrder(orders.find(order => order.id === row.id)!, config) }
      : { data: buildReceiptDataFromPosOrder(row, config), posOrder: row });
  }

  const local = outbox.enabled ? outbox.recent.filter(order => matchesOrderSearch(order, search) && matchesOrderFilters(order, value, cashierId, TIMEZONE)) : [];
  const filtered = (['status', 'customerId', 'cashierId', 'registerId', 'paymentMethod', 'storeId', 'createdVia'] as const)
    .some(key => value[key] !== initial[key]) || value.dateRange?.from !== initial.dateRange?.from || value.dateRange?.to !== initial.dateRange?.to;
  const footer = history ? <>
    {hasMore && <Button testID="orders-load-more" disabled={loading} onPress={() => { void loadPage(page + 1, search); }}><Text>Load more</Text></Button>}
    {failed && <>
      <Text>Store orders couldn't be loaded.</Text>
      <Button testID="orders-history-retry" disabled={loading} onPress={() => { void loadPage(page + 1, search); }}><Text>Try again</Text></Button>
    </>}
  </> : undefined;
  return (
    <View className="flex-1 bg-background">
      <AreaToolbar area="orders" title="Orders" onBack={onBack}
        search={outbox.enabled && !opened && !viewing ? <SearchInput testID="search-orders" value={term} onChangeText={setTerm} placeholder="Search Orders" /> : null}>
        <AreaDisplayOptions area="orders" columns={ORDERS_COLUMNS} settings={columns} onChange={setColumns} />
      </AreaToolbar>
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
          ? <View className="min-h-0 flex-1 px-4 pb-4"><ReceiptZoom><ReceiptPrintSheet orderId={opened.posOrder?.id ?? opened.data.header.orderNumber}><Receipt receipt={opened.data} posOrder={opened.posOrder} newSale={() => setOpened(null)} doneLabel="Back" /></ReceiptPrintSheet></ReceiptZoom></View>
          : local.length === 0 && orders.length === 0 && !failed
            ? loading
              ? <View testID="orders-loading" className="flex-1" />
              : search !== '' || filtered
                ? <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
                    <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No orders match these filters</Text>
                    <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={clear}><Text>Clear filters</Text></Button>
                  </View>
                : <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
                    <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No orders yet</Text>
                    <Text testID="no-data-message-description" className="text-center text-muted-foreground">Sales you take will appear here.</Text>
                  </View>
            : <OrdersTable local={local} store={orders} footer={footer} active={loading}
              visible={columns.filter(column => column.visible).map(column => column.id)}
              onSync={history ? () => { void loadPage(1, search); } : undefined}
              onOpen={row => { if (row.kind === 'store') setViewing(row.order); else open(row.order); }} />
        : <View testID="orders-unavailable" className={`py-4 ${gutter}`}><Text>Orders show once the store is connected.</Text></View>}
      {outbox.enabled && viewing && !opened && <OrderDetailSheet order={viewing} onReceipt={() => open(toHistoryRow(viewing))} onClose={() => setViewing(null)} />}
    </View>
  );
}
