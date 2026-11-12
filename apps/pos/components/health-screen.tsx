import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@tallyui/components';
import type { ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { useStorageEstimate } from '../lib/health/use-storage-estimate';
import { useOutbox } from '../lib/sale/outbox-context';
import { QueuedEmailsPanel } from './queued-emails-panel';
import { DatabaseCounts, type DatabaseCountRow } from './database-counts';
import { DatabaseStats } from './database-stats';
import { RejectedOrdersPanel } from './rejected-orders-panel';
import { StuckRecordsBanner } from './stuck-records-banner';

export function HealthScreen({ receiptEmails, collections }: {
  receiptEmails: ReceiptEmailCollection; collections: DatabaseCountRow[];
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
  // The Store health area (app/health/_layout.tsx) draws the scroll, the page title and the way back.
  return (
    <View testID="screen-health-database">
      {/* v2's AreaPage description (core/src/screens/main/health/database.tsx:637; navigation-area/area-page.tsx:50) is
          Text `help` (components/src/text/ladder.ts:15): `text-muted-foreground text-xs`. */}
      <Text testID="db-subtitle" className="mb-4 text-xs text-muted-foreground">Your store, on this device — sales keep working even if your server does not.</Text>
      <View className="gap-4">
        <DatabaseStats counts={counts} storageBytes={storageBytes} waiting={outbox.enabled ? outbox.state.pending : 0} />
        {/* v2 database.tsx: the attention panel follows the stat strip. */}
        <StuckRecordsBanner />
        <RejectedOrdersPanel orders={orders} onRequeue={ids => (outbox.enabled ? outbox.requeue(ids) : Promise.resolve(0))} />
        <DatabaseCounts rows={rows} onCount={onCount} />
        <QueuedEmailsPanel collection={receiptEmails} orders={orders} />
      </View>
    </View>
  );
}
