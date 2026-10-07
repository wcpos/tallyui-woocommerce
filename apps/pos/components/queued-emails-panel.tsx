import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Badge, Button, Text } from '@tallyui/components';
import type { PosOrder } from '@tallyui/pos';
import { queueReceiptEmail, type ReceiptEmail, type ReceiptEmailCollection } from '../lib/receipts/receipt-emails';

export function queuedAgo(queuedAt: string, now: Date): string {
  const seconds = (new Date(queuedAt).getTime() - now.getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (Math.abs(seconds) < 60) return format.format(Math.trunc(seconds), 'second');
  if (Math.abs(seconds) < 3600) return format.format(Math.trunc(seconds / 60), 'minute');
  if (Math.abs(seconds) < 86400) return format.format(Math.trunc(seconds / 3600), 'hour');
  return format.format(Math.trunc(seconds / 86400), 'day');
}

export function QueuedEmailsPanel({ collection, orders, now = () => new Date() }: {
  collection: ReceiptEmailCollection; orders: RxCollection<PosOrder> | null; now?: () => Date;
}) {
  const [rows, setRows] = useState<ReceiptEmail[]>([]);
  const [orderNumbers, setOrderNumbers] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const subscription = collection.find({ selector: { status: { $in: ['queued', 'sending', 'failed'] } },
      sort: [{ queuedAt: 'asc' }] }).$.subscribe(docs => setRows(docs.map(doc => doc.toJSON())));
    return () => subscription.unsubscribe();
  }, [collection]);
  useEffect(() => {
    let active = true;
    async function resolveOrders() {
      const numbers = await Promise.all(rows.map(async row => {
        const order = await orders?.findOne(row.id).exec();
        return [row.id, order?.serverRefs?.orderId] as const;
      }));
      if (active) setOrderNumbers(Object.fromEntries(numbers));
    }
    void resolveOrders();
    const subscription = orders?.$.subscribe(() => { void resolveOrders(); });
    return () => { active = false; subscription?.unsubscribe(); };
  }, [rows, orders]);

  async function sendAgain(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const latest = await collection.findOne(id).exec();
      if (latest?.status === 'failed') await queueReceiptEmail(collection, id, latest.email);
    } catch {
      setMessage('Couldn’t send that email.');
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      const latest = await collection.findOne(id).exec();
      if (!latest) return;
      if (latest.status === 'sending') {
        setMessage('Delivery has already started and can’t be cancelled. The customer may still receive this email.');
        return;
      }
      await latest.remove();
      setMessage('Removed from the queue.');
    } catch {
      setMessage('Couldn’t remove that email.');
    } finally { setBusy(false); }
  }

  if (!rows.length) return null;
  const failed = rows.filter(row => row.status === 'failed').length;
  const body = failed === 1
    ? '1 of these could not be sent and has stopped trying. Review the reason below, then remove it or send it again.'
    : failed > 1 ? `${failed} of these could not be sent and have stopped trying. Review the reasons below, then remove them or send them again.`
    : 'These are waiting for another send attempt. They may be retried automatically while this device can reach your store, but delivery is not guaranteed.';
  return (
    <View className="gap-3">
      <View testID="db-queued-emails-callout" className="gap-3 rounded-lg border border-border p-4">
        <Text className="font-semibold">{`${rows.length} receipt email${rows.length === 1 ? '' : 's'} waiting to go out`}</Text>
        <Text>{body}</Text>
        {rows.map(row => <View key={row.id} testID={`db-queued-email-row-${row.id}`} className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
          <Text>{`${row.email} · ${orderNumbers[row.id] !== undefined ? `#${orderNumbers[row.id]}` : `order ${row.id}`}`}</Text>
          <Badge variant={row.status === 'failed' ? 'destructive' : 'warning'} label={row.status === 'failed' ? 'failed' : 'waiting'}
            testID={`db-queued-email-${row.status === 'failed' ? 'failed' : 'pending'}-${row.id}`} />
          </View>
          <Text>{`queued ${queuedAgo(row.queuedAt, now())}`}</Text>
          {row.error && <Text>{row.error}</Text>}
          <View className="flex-row gap-2">
            {row.status === 'failed' && <Button testID={`db-queued-email-retry-${row.id}`} disabled={busy}
              onPress={() => { void sendAgain(row.id); }}><Text>Send again</Text></Button>}
            <Button variant="ghost" testID={`db-queued-email-remove-${row.id}`} disabled={busy}
              onPress={() => { void remove(row.id); }}><Text className="text-destructive">Remove</Text></Button>
          </View>
        </View>)}
      </View>
      {message && <Text testID="db-queued-emails-message">{message}</Text>}
    </View>
  );
}
