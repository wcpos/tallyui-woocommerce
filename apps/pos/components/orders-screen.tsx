import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Receipt, SearchInput, Text, type OrderHistoryRow } from '@tallyui/components';
import type { StoreOrder } from '@tallyui/core';
import { buildReceiptDataFromPosOrder, buildReceiptDataFromStoreOrder, type PosOrder, type ReceiptConfig } from '@tallyui/pos';
import { useOutbox } from '../lib/sale/outbox-context';
import { useRegister } from '../lib/register/register-context';
import { matchesOrderSearch, toHistoryRow, type OrderHistorySource } from '../lib/orders/order-history';
import { OrdersTable } from './orders-table';
import { OrderDetailView } from './order-detail';
import { ReceiptPrintSheet } from './receipt-print-sheet';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';

// The till id; the bound register is the drawer.
const REGISTER_ID = 'web';
// v2's QuerySearchInput debounce (packages/core/src/screens/main/components/query-search-input.tsx:33).
const SEARCH_DEBOUNCE_MS = 250;

export function OrdersScreen({ onBack, history, storeName, cashierName }: {
  onBack(): void; history: OrderHistorySource | null; storeName: string; cashierName: string;
}) {
  const outbox = useOutbox();
  const register = useRegister();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(history !== null);
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState<{ data: ReturnType<typeof buildReceiptDataFromPosOrder>; posOrder?: PosOrder } | null>(null);
  const [viewing, setViewing] = useState<StoreOrder | null>(null);
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
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
      const result = await (query ? history!.list(nextPage, query) : history!.list(nextPage));
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
  }, [outbox.enabled, history, search]);

  function scan(code: string) { setTerm(code); setSearch(code.trim()); }
  useWedgeScanner(scan, outbox.enabled && opened === null && viewing === null);

  function clear() { setTerm(''); setSearch(''); }

  function open(row: PosOrder | OrderHistoryRow) {
    const n = (counts.current.get(row.id) ?? 0) + 1;
    counts.current.set(row.id, n);
    const config: ReceiptConfig = { storeName, cashier: cashierName, register: REGISTER_ID,
      registerName: register?.registerName ?? undefined, fiscal: { reprint_count: n } };
    setOpened('placedAt' in row
      ? { data: buildReceiptDataFromStoreOrder(orders.find(order => order.id === row.id)!, config) }
      : { data: buildReceiptDataFromPosOrder(row, config), posOrder: row });
  }

  const local = outbox.enabled ? outbox.recent.filter(order => matchesOrderSearch(order, search)) : [];
  const footer = history ? <>
    {hasMore && <Button testID="orders-load-more" disabled={loading} onPress={() => { void loadPage(page + 1, search); }}><Text>Load more</Text></Button>}
    {failed && <>
      <Text>Store orders couldn't be loaded.</Text>
      <Button testID="orders-history-retry" disabled={loading} onPress={() => { void loadPage(page + 1, search); }}><Text>Try again</Text></Button>
    </>}
  </> : undefined;
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between p-4">
        <Text accessibilityRole="header">Orders</Text>
        <Button testID="orders-back" onPress={onBack}><Text>Back</Text></Button>
      </View>
      {outbox.enabled && !opened && !viewing && <View className="px-4 pb-2"><SearchInput testID="search-orders" value={term} onChangeText={setTerm} placeholder="Search Orders" /></View>}
      {outbox.enabled
        ? opened
          ? <ReceiptPrintSheet orderId={opened.posOrder?.id ?? opened.data.header.orderNumber}><Receipt receipt={opened.data} posOrder={opened.posOrder} newSale={() => setOpened(null)} doneLabel="Back" /></ReceiptPrintSheet>
          : viewing ? <OrderDetailView order={viewing} onReceipt={() => open(toHistoryRow(viewing))} onClose={() => setViewing(null)} />
          : local.length === 0 && orders.length === 0 && !failed
            ? loading
              ? <View testID="orders-loading" className="flex-1" />
              : search !== ''
                ? <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
                    <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No orders match these filters</Text>
                    <Button testID="no-data-message-action" variant="ghost" size="sm" onPress={clear}><Text>Clear filters</Text></Button>
                  </View>
                : <View testID="no-data-message" className="flex-1 items-center justify-center gap-2 p-6">
                    <Text testID="no-data-message-title" className="text-center font-medium text-foreground">No orders yet</Text>
                    <Text testID="no-data-message-description" className="text-center text-muted-foreground">Sales you take will appear here.</Text>
                  </View>
            : <OrdersTable local={local} store={orders} footer={footer}
              onOpen={row => { if (row.kind === 'store') setViewing(row.order); else open(row.order); }} />
        : <View className="p-4"><Text>Orders show once the store is connected.</Text></View>}
    </View>
  );
}
