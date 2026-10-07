import { ScrollView, View } from 'react-native';
import { Button, Text } from '@tallyui/components';
import type { ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { useOutbox } from '../lib/sale/outbox-context';
import { QueuedEmailsPanel } from './queued-emails-panel';

export function HealthScreen({ receiptEmails, onBack }: {
  receiptEmails: ReceiptEmailCollection; onBack(): void;
}) {
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  return (
    <ScrollView className="flex-1 bg-background p-4">
      <View className="mb-4 flex-row items-center gap-4">
        <Button testID="health-back" onPress={onBack}><Text>Back</Text></Button>
        <Text className="text-xl font-semibold">Store health</Text>
      </View>
      <QueuedEmailsPanel collection={receiptEmails} orders={orders} />
    </ScrollView>
  );
}
