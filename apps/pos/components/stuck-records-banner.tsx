import { useEffect, useState, type JSX } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, orderReference } from '@tallyui/components';
import { IDLE_OUTBOX_STATE, outboxSyncStats } from '../lib/logs/log-view';
import { useOutbox } from '../lib/sale/outbox-context';

/**
 * v2's Database attention panel (packages/core/src/screens/main/health/attention-panel.tsx): the stuck count, the oldest
 * failing sale's server reason, Retry (the outbox's flush, which re-attempts the pending queue) and View log. No Fix
 * record: Tally has no edit surface for a stuck sale. Drawn as rejected-orders-panel.tsx draws its callout, the
 * title in the destructive tone (TallyUI has no notice component).
 */
export function StuckRecordsBanner(): JSX.Element | null {
  const router = useRouter();
  const outbox = useOutbox();
  const sync = outboxSyncStats(outbox.enabled ? outbox.state : IDLE_OUTBOX_STATE);
  const first = sync.failing[0];
  const orders = outbox.enabled ? outbox.orders : null;
  const [name, setName] = useState<string>();
  useEffect(() => {
    setName(undefined);
    if (!orders || !first) return;
    const subscription = orders.findOne({ selector: { commandId: first.commandId } }).$
      .subscribe(order => setName(order ? orderReference(order) : undefined));
    return () => subscription.unsubscribe();
  }, [orders, first?.commandId]);
  if (sync.stuck === 0) return null;
  const n = sync.stuck;
  return (
    <View testID="db-attention-panel" className="gap-3 rounded-lg border border-border p-4">
      <View className="gap-1">
        <Text testID="db-attention-title" className="font-semibold text-destructive">
          {`${n} ${n === 1 ? 'record needs' : 'records need'} attention`}</Text>
        {/* Never the raw command id: support reads that from the log. */}
        {first && <Text testID="db-attention-reason">{`"${name ?? 'A sale'}" can't upload — ${first.reason}`}</Text>}
      </View>
      <View className="flex-row items-center gap-1">
        {/* Only a failing pending sale is retried; a refused one is sent again from the refused panel below. */}
        {outbox.enabled && first && <Button size="sm" testID="db-attention-retry" onPress={() => { void outbox.flush(); }}>
          <Text>Retry</Text></Button>}
        <Button variant="ghost" size="sm" testID="db-attention-view-log" onPress={() => router.push('/health/logs')}>
          <Text>View log ›</Text></Button>
      </View>
    </View>
  );
}
