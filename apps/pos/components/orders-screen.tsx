import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, OrdersList, Receipt, Text, type OrderHistoryRow } from '@tallyui/components';
import type { StoreOrder } from '@tallyui/core';
import { buildReceiptDataFromPosOrder, buildReceiptDataFromStoreOrder, type PosOrder, type ReceiptConfig } from '@tallyui/pos';
import { useOutbox } from '../lib/sale/outbox-context';
import { useRegister } from '../lib/register/register-context';
import { toHistoryRow, type OrderHistorySource } from '../lib/orders/order-history';

// The till id; the bound register is the drawer.
const REGISTER_ID = 'web';

export function OrdersScreen({ onBack, history, storeName, cashierName }: {
  onBack(): void; history: OrderHistorySource | null; storeName: string; cashierName: string;
}) {
  const outbox = useOutbox();
  const register = useRegister();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [opened, setOpened] = useState<{ data: ReturnType<typeof buildReceiptDataFromPosOrder>; posOrder?: PosOrder } | null>(null);
  // The count is in memory only, for each order opened in this screen.
  const counts = useRef(new Map<string, number>());

  async function loadPage(nextPage: number) {
    setLoading(true);
    setFailed(false);
    try {
      const result = await history!.list(nextPage);
      setOrders(current => [...new Map([...current, ...result.orders].map(order => [order.id, order])).values()]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (outbox.enabled && history) void loadPage(1);
  }, [outbox.enabled, history]);

  function open(row: PosOrder | OrderHistoryRow) {
    const n = (counts.current.get(row.id) ?? 0) + 1;
    counts.current.set(row.id, n);
    const config: ReceiptConfig = { storeName, cashier: cashierName, register: REGISTER_ID,
      registerName: register?.registerName ?? undefined, fiscal: { reprint_count: n } };
    setOpened('placedAt' in row
      ? { data: buildReceiptDataFromStoreOrder(orders.find(order => order.id === row.id)!, config) }
      : { data: buildReceiptDataFromPosOrder(row, config), posOrder: row });
  }

  const footer = history ? <>
    {hasMore && <Button testID="orders-load-more" disabled={loading} onPress={() => { void loadPage(page + 1); }}><Text>Load more</Text></Button>}
    {failed && <>
      <Text>Store orders couldn't be loaded.</Text>
      <Button testID="orders-history-retry" disabled={loading} onPress={() => { void loadPage(page + 1); }}><Text>Try again</Text></Button>
    </>}
  </> : undefined;
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between p-4">
        <Text accessibilityRole="header">Orders</Text>
        <Button testID="orders-back" onPress={onBack}><Text>Back</Text></Button>
      </View>
      {outbox.enabled
        ? opened
          ? <Receipt receipt={opened.data} posOrder={opened.posOrder} newSale={() => setOpened(null)} doneLabel="Back" />
          : <OrdersList orders={outbox.recent} onRetry={ids => outbox.requeue(ids)} stuck={outbox.state.stuck}
              history={orders.map(toHistoryRow)} onOpen={open} footer={footer} />
        : <View className="p-4"><Text>Orders show once the store is connected.</Text></View>}
    </View>
  );
}
