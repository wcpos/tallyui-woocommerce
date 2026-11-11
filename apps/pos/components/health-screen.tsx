import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { useStorageEstimate } from '../lib/health/use-storage-estimate';
import { useOutbox } from '../lib/sale/outbox-context';
import { QueuedEmailsPanel } from './queued-emails-panel';
import { DatabaseCounts, type DatabaseCountRow } from './database-counts';
import { DatabaseStats } from './database-stats';
import { RejectedOrdersPanel } from './rejected-orders-panel';

export function HealthScreen({ receiptEmails, collections, onBack }: {
  receiptEmails: ReceiptEmailCollection; collections: DatabaseCountRow[]; onBack(): void;
}) {
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const rows = orders ? [...collections, { key: 'orders', label: 'Orders', collection: orders }] : collections;
  const [reported, setReported] = useState<Record<string, number>>({});
  const onCount = useCallback((key: string, count: number) =>
    setReported(prev => (prev[key] === count ? prev : { ...prev, [key]: count })), []);
  // Only the rows shown now; a row still counting is null
  const counts = Object.fromEntries(rows.map(row => [row.key, reported[row.key] ?? null]));
  const storageBytes = useStorageEstimate();
  return (
    <ScrollView testID="screen-health-database" className="flex-1 bg-background p-4">
      <View className="mb-4 flex-row items-center gap-4">
        <Button testID="health-back" onPress={onBack}><Text>Back</Text></Button>
        <Text className="text-xl font-semibold">Store health</Text>
      </View>
      <Text className="mb-4">Your store, on this device — sales keep working even if your server does not.</Text>
      <View className="gap-4">
        <DatabaseStats counts={counts} storageBytes={storageBytes} waiting={outbox.enabled ? outbox.state.pending : 0} />
        <RejectedOrdersPanel orders={orders} onRequeue={ids => (outbox.enabled ? outbox.requeue(ids) : Promise.resolve(0))} />
        <DatabaseCounts rows={rows} onCount={onCount} />
        <QueuedEmailsPanel collection={receiptEmails} orders={orders} />
      </View>
    </ScrollView>
  );
}
