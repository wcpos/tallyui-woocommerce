import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { RxCollection } from 'rxdb';
import { Badge, Button, Text } from '@tallyui/components';
import type { PosOrder } from '@tallyui/pos';
import { queueReceiptEmail, type ReceiptEmail, type ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { toast } from '../lib/toast/toast';

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
  useEffect(() => {
    const subscription = collection.find({ selector: { status: { $in: ['queued', 'sending', 'failed'] } },
      sort: [{ queuedAt: 'asc' }] }).$.subscribe(docs => setRows(docs.map(doc => doc.toJSON()).sort(
        (a, b) => (a.status === 'failed') === (b.status === 'failed') ? a.queuedAt.localeCompare(b.queuedAt) : a.status === 'failed' ? -1 : 1)));
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
    try {
      const latest = await collection.findOne(id).exec();
      if (latest?.status === 'failed') {
        await queueReceiptEmail(collection, id, latest.email, undefined, { saveToBilling: latest.saveToBilling === true });
      }
    } catch {
      // v2 queued-emails.tsx:82-112: each outcome is a toast of v2's type.
      toast({ type: 'error', title: 'Couldn’t send that email.' });
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      const latest = await collection.findOne(id).exec();
      if (!latest) return;
      if (latest.status === 'sending') {
        toast({ type: 'warning', title: 'Delivery has already started and can’t be cancelled. The customer may still receive this email.' });
        return;
      }
      await latest.remove();
      toast({ type: 'success', title: 'Removed from the queue.' });
    } catch {
      toast({ type: 'error', title: 'Couldn’t remove that email.' });
    } finally { setBusy(false); }
  }

  if (!rows.length) return null;
  const failed = rows.filter(row => row.status === 'failed').length;
  const body = failed === 1
    ? '1 of these could not be sent and has stopped trying. Review the reason below, then remove it or send it again.'
    : failed > 1 ? `${failed} of these could not be sent and have stopped trying. Review the reasons below, then remove them or send them again.`
    : 'These are waiting for another send attempt. They may be retried automatically while this device can reach your store, but delivery is not guaranteed.';
  return (
    <View testID="db-queued-emails" className="gap-2">
      {/* v2 queued-emails.tsx:120-130: a Notice band, bad when any has failed, else warning; the rows sit below it. */}
      <View testID="db-queued-emails-callout" role={failed > 0 ? 'alert' : 'status'} aria-live={failed > 0 ? 'assertive' : 'polite'}
        className={`flex-row flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 ${failed > 0 ? 'border-destructive/45 bg-destructive/10' : 'border-warning/45 bg-warning/15'}`}>
        <View className="min-w-0 flex-1 basis-48">
          <Text testID="db-queued-emails-title" className="font-medium text-foreground">{`${rows.length} receipt email${rows.length === 1 ? '' : 's'} waiting to go out`}</Text>
          <Text testID="db-queued-emails-description" className="text-muted-foreground">{body}</Text>
        </View>
      </View>
      <View testID="db-queued-emails-rows">
        {rows.map(row => <View key={row.id} testID={`db-queued-email-row-${row.id}`} className="flex-row flex-wrap items-center gap-2 border-b border-border py-2">
          <View className="min-w-0 flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-medium">{`${row.email} · ${orderNumbers[row.id] !== undefined ? `#${orderNumbers[row.id]}` : `order ${row.id}`}`}</Text>
              <Badge variant={row.status === 'failed' ? 'destructive' : 'warning'} label={row.status === 'failed' ? 'failed' : 'waiting'}
                testID={`db-queued-email-${row.status === 'failed' ? 'failed' : 'pending'}-${row.id}`} />
            </View>
            <Text testID={`db-queued-email-when-${row.id}`} className="text-xs text-muted-foreground">{`queued ${queuedAgo(row.queuedAt, now())}${row.attempts > 0 ? ` · ${row.attempts} ${row.attempts === 1 ? 'try' : 'tries'}` : ''}`}</Text>
            {row.error ? <Text testID={`db-queued-email-error-${row.id}`} className="text-xs text-muted-foreground/80">{row.error}</Text> : null}
          </View>
          <View className="flex-row items-center gap-2">
            {row.status === 'failed' && <Button variant="outline" size="sm" testID={`db-queued-email-retry-${row.id}`} disabled={busy}
              onPress={() => { void sendAgain(row.id); }}><Text>Send again</Text></Button>}
            <Button variant="ghost" size="sm" testID={`db-queued-email-remove-${row.id}`} disabled={busy}
              onPress={() => { void remove(row.id); }}><Text className="text-destructive">Remove</Text></Button>
          </View>
        </View>)}
      </View>
    </View>
  );
}
