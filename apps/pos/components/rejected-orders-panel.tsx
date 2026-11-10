import { useEffect, useRef, useState, type JSX } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Button, Text } from '@tallyui/components';
import { isReopened, isRequeueable, watchFresh, type PosOrder } from '@tallyui/pos';
import { queuedAgo } from './queued-emails-panel';

export function RejectedOrdersPanel({ orders, onRequeue, now = () => new Date() }: {
  orders: RxCollection<PosOrder> | null;
  onRequeue(orderIds: string[]): Promise<number>;
  now?: () => Date;
}): JSX.Element | null {
  const [rows, setRows] = useState<PosOrder[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const guard = useRef(false);
  useEffect(() => {
    if (!orders) { setRows([]); return; }
    const subscription = watchFresh(orders, { selector: { syncStatus: 'rejected' }, sort: [{ createdAt: 'desc' }] })
      .subscribe(next => {
        // A reopened refusal lives on as a parked sale and must not be sent again (ADR-077 d4b).
        setRows(next.filter(order => !isReopened(order)));
      });
    return () => subscription.unsubscribe();
  }, [orders]);

  async function requeue(id: string) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    try {
      const count = await onRequeue([id]);
      setMessage(count > 0 ? 'Queued to send again.' : 'Couldn’t queue that again.');
    } catch { setMessage('Couldn’t queue that again.'); }
    finally { guard.current = false; setBusy(false); }
  }
  if (!rows.length) return null;
  const n = rows.length;
  return (
    <View testID="db-rejected" className="gap-3 rounded-lg border border-border p-4">
      <View testID="db-rejected-callout" className="gap-1">
        <Text className="font-semibold">{`${n} ${n === 1 ? 'change' : 'changes'} never reached your server`}</Text>
        <Text>Your server refused these and nothing will retry them on its own. Send again rebuilds each one from what is on this device; discard drops the local change and keeps your server’s version.</Text>
      </View>
      {rows.map(order => {
        const label = order.serverRefs?.orderId ? `Orders · #${order.serverRefs.orderId}` : `Orders · ${order.id.slice(0, 8)}`;
        const reason = (order.error && [order.error.code, order.error.message].filter(Boolean).join(' · '))
          || 'Your server refused it without saying why.';
        return (
          <View key={order.id} testID={`db-rejected-row-${order.id}`} className="gap-1">
            <Text className="font-semibold">{label}</Text>
            <Text>{reason}</Text>
            <Text>{`refused ${queuedAgo(order.updatedAt, now())}`}</Text>
            {isRequeueable(order.error?.code) && <Button variant="ghost" testID={`db-rejected-requeue-${order.id}`} disabled={busy} onPress={() => { void requeue(order.id); }}><Text>Send again</Text></Button>}
          </View>
        );
      })}
      {message && <Text testID="db-rejected-message">{message}</Text>}
    </View>
  );
}
