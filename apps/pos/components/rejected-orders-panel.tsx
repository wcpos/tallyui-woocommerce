import { useRef, useState, type JSX } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Text } from '@tallyui/components';
import { isRequeueable, type PosOrder } from '@tallyui/pos';
import { refusedReason, useRefusedOrders } from '../lib/orders/use-refused-orders';
import { toast } from '../lib/toast/toast';
import { queuedAgo } from './queued-emails-panel';

// v2 core.json:2640 resolution_failed_hint, "reload WCPOS" as "reload the app" (the app never names itself to a cashier).
const REQUEUE_FAILED = { type: 'error', title: 'Couldn’t queue that again.', description: 'Try again. If it keeps failing, reload the app.' } as const;

export function RejectedOrdersPanel({ orders, onRequeue, now = () => new Date() }: {
  orders: RxCollection<PosOrder> | null;
  onRequeue(orderIds: string[]): Promise<number>;
  now?: () => Date;
}): JSX.Element | null {
  const rows = useRefusedOrders(orders);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);

  async function requeue(id: string) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      const count = await onRequeue([id]);
      // v2 rejected-mutations.tsx:99-148: the result is a toast; a count of 0 is a failure.
      toast(count > 0 ? { type: 'success', title: 'Queued to send again.' } : REQUEUE_FAILED);
    } catch { toast(REQUEUE_FAILED); }
    finally { guard.current = false; setBusy(false); }
  }
  if (!rows.length) return null;
  const n = rows.length;
  return (
    <View testID="db-rejected" className="gap-3 rounded-lg border border-border p-4">
      <View testID="db-rejected-callout" className="gap-1">
        <Text className="font-semibold">{`${n} ${n === 1 ? 'change' : 'changes'} never reached your server`}</Text>
        <Text>Your server refused these and nothing will retry them on its own. Send again rebuilds each one from what is on this device.</Text>
      </View>
      {rows.map(order => {
        const label = order.serverRefs?.orderId ? `Orders · #${order.serverRefs.orderId}` : `Orders · ${order.id.slice(0, 8)}`;
        const reason = refusedReason(order);
        return (
          <View key={order.id} testID={`db-rejected-row-${order.id}`} className="gap-1">
            <Text className="font-semibold">{label}</Text>
            <Text>{reason}</Text>
            <Text>{`refused ${queuedAgo(order.updatedAt, now())}`}</Text>
            {isRequeueable(order.error?.code) && <Button variant="ghost" testID={`db-rejected-requeue-${order.id}`} disabled={busy} onPress={() => { void requeue(order.id); }}><Text>Send again</Text></Button>}
          </View>
        );
      })}
    </View>
  );
}
