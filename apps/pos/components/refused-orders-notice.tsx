import type { JSX } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Text, orderReference } from '@tallyui/components';
import type { PosOrder } from '@tallyui/pos';
import { refusedReason, useRefusedOrders } from '../lib/orders/use-refused-orders';

const SHOWN = 3; // v2: the newest few, then a count, so the band never pushes the list off a till.
/** WCPOS v2 orders/attention-notice.tsx: the sales the store refused, on Orders, with the reason and Open order. No Handled (the app keeps no handled flag): Review goes to Store health, where Send again lives. */
export function RefusedOrdersNotice({ orders, onOpen, onReview, className }: {
  orders: RxCollection<PosOrder> | null; onOpen(order: PosOrder): void; onReview?(): void; className?: string;
}): JSX.Element | null {
  const rows = useRefusedOrders(orders);
  if (!rows.length) return null;
  const n = rows.length, hidden = n - SHOWN;
  return <View className={className}><View testID="orders-attention" className="gap-2 rounded-lg border border-border p-4">
    <Text testID="orders-attention-title" className="font-semibold text-destructive">{`${n} ${n === 1 ? 'sale needs' : 'sales need'} attention`}</Text>
    {rows.slice(0, SHOWN).map(order => (
      <View key={order.id} testID={`orders-attention-row-${order.id}`} className="flex-row items-center justify-between gap-2">
        <Text className="flex-1">{`${orderReference(order)} — ${refusedReason(order)}`}</Text>
        <Button variant="ghost" size="sm" testID={`orders-attention-open-${order.id}`} onPress={() => onOpen(order)}><Text>Open order</Text></Button>
      </View>
    ))}
    {hidden > 0 && <Text testID="orders-attention-more" className="text-muted-foreground">{`and ${hidden} more`}</Text>}
    {onReview && <Button variant="ghost" size="sm" testID="orders-attention-review" onPress={onReview}><Text>Review in Store health ›</Text></Button>}
  </View></View>;
}
