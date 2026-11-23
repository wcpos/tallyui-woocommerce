import type { JSX } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Text, orderReference } from '@tallyui/components';
import { markAttentionHandled, type PosOrder } from '@tallyui/pos';
import { useFormatStoreMoney } from '../lib/money/store-money';
import { refusedReason, useRefusedOrders } from '../lib/orders/use-refused-orders';
import { useTotalMismatchOrders } from '../lib/orders/use-total-mismatch-orders';

const SHOWN = 3; // v2: the newest few, then a count, so the band never pushes the list off a till.
/**
 * WCPOS v2 orders/attention-notice.tsx: on Orders, the sales the store refused (with its reason) and the sales it
 * accepted at a different total (with both totals), newest first, each with Open order. Handled exists for the
 * accepted-at-a-different-total rows only; refused rows still go to Store health (Review), where Send again lives.
 */
export function RefusedOrdersNotice({ orders, onOpen, onReview, className }: {
  orders: RxCollection<PosOrder> | null; onOpen(order: PosOrder): void; onReview?(): void; className?: string;
}): JSX.Element | null {
  const refused = useRefusedOrders(orders), mismatched = useTotalMismatchOrders(orders);
  const fmt = useFormatStoreMoney();
  const rows = [...refused.map(order => ({ order, mismatch: undefined })), ...mismatched.map(row => ({ order: row.order, mismatch: row }))]
    .sort((a, b) => b.order.createdAt.localeCompare(a.order.createdAt));
  if (!rows.length) return null;
  const n = rows.length, hidden = n - SHOWN;
  return <View className={className}><View testID="orders-attention" className="gap-2 rounded-lg border border-border p-4">
    <Text testID="orders-attention-title" className="font-semibold text-destructive">{`${n} ${n === 1 ? 'sale needs' : 'sales need'} attention`}</Text>
    {rows.slice(0, SHOWN).map(({ order, mismatch }) => (
      <View key={order.id} testID={`orders-attention-row-${order.id}`} className="flex-row items-center justify-between gap-2">
        <Text className="flex-1">{`${orderReference(order)} — ${mismatch
          ? `The store recorded ${fmt({ amount: mismatch.serverMinor, currency: order.currency })} for this sale, but the till charged ${fmt({ amount: mismatch.expectedMinor, currency: order.currency })}.`
          : refusedReason(order)}`}</Text>
        <Button variant="ghost" size="sm" testID={`orders-attention-open-${order.id}`} onPress={() => onOpen(order)}><Text>Open order</Text></Button>
        {mismatch && orders && <Button variant="ghost" size="sm" testID={`orders-attention-handled-${order.id}`}
          // A failure leaves the row in place, so the cashier sees it was not taken.
          onPress={() => { void markAttentionHandled(orders, order.id).catch(() => undefined); }}><Text>Handled</Text></Button>}
      </View>
    ))}
    {hidden > 0 && <Text testID="orders-attention-more" className="text-muted-foreground">{`and ${hidden} more`}</Text>}
    {onReview && <Button variant="ghost" size="sm" testID="orders-attention-review" onPress={onReview}><Text>Review in Store health ›</Text></Button>}
  </View></View>;
}
