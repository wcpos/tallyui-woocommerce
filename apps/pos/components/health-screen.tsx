import { ScrollView, View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { useOutbox } from '../lib/sale/outbox-context';
import { QueuedEmailsPanel } from './queued-emails-panel';
import { DatabaseCounts, type DatabaseCountRow } from './database-counts';
import { RejectedOrdersPanel } from './rejected-orders-panel';

export function HealthScreen({ receiptEmails, collections, onBack }: {
  receiptEmails: ReceiptEmailCollection; collections: DatabaseCountRow[]; onBack(): void;
}) {
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const rows = orders ? [...collections, { key: 'orders', label: 'Orders', collection: orders }] : collections;
  return (
    <ScrollView testID="screen-health-database" className="flex-1 bg-background p-4">
      <View className="mb-4 flex-row items-center gap-4">
        <Button testID="health-back" onPress={onBack}><Text>Back</Text></Button>
        <Text className="text-xl font-semibold">Store health</Text>
      </View>
      <Text className="mb-4">Your store, on this device — sales keep working even if your server does not.</Text>
      <View className="gap-4">
        <RejectedOrdersPanel orders={orders} onRequeue={ids => (outbox.enabled ? outbox.requeue(ids) : Promise.resolve(0))} />
        <DatabaseCounts rows={rows} />
        <QueuedEmailsPanel collection={receiptEmails} orders={orders} />
      </View>
    </ScrollView>
  );
}
