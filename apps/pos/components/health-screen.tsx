import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { Button, Loader, Text } from '@tallyui/components';
import type { SyncCadenceRunner } from '@tallyui/database';
import type { ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { useStorageEstimate } from '../lib/health/use-storage-estimate';
import { useCheckStatusLabel } from '../lib/health/use-check-status';
import { useManualSync } from '../lib/health/use-manual-sync';
import { useOutbox } from '../lib/sale/outbox-context';
import { isReadyToSell } from '../lib/health/database-stats';
import { useOnlineStatus } from '../lib/online/online-status';
import { QueuedEmailsPanel } from './queued-emails-panel';
import { DatabaseCounts, type DatabaseCountRow } from './database-counts';
import { DatabaseStats } from './database-stats';
import { RejectedOrdersPanel } from './rejected-orders-panel';
import { StuckRecordsBanner } from './stuck-records-banner';
import { DocsLink } from './docs-link';

const HOW_SYNCING_WORKS_DOCS_URL = 'https://docs.wcpos.com/products/sync'; // v2 health/database.tsx:557

export function HealthScreen({ receiptEmails, collections, runner }: {
  receiptEmails: ReceiptEmailCollection; collections: DatabaseCountRow[];
  /** The catalogue polling runner, for the check line (as Logs reads it). */
  runner?: Pick<SyncCadenceRunner, 'nextDueAtMs$'>;
}) {
  const outbox = useOutbox();
  const orders = outbox.enabled ? outbox.orders : null;
  const rows: DatabaseCountRow[] = orders ? [...collections, { key: 'orders', label: 'Orders', collection: orders }] : collections;
  const [reported, setReported] = useState<Record<string, number>>({});
  const onCount = useCallback((key: string, count: number) =>
    setReported(prev => (prev[key] === count ? prev : { ...prev, [key]: count })), []);
  // Only the rows shown now; a row still counting is null
  const counts = Object.fromEntries(rows.map(row => [row.key, reported[row.key] ?? null]));
  const storageBytes = useStorageEstimate();
  const offline = useOnlineStatus().status === 'offline';
  // database-stats.tsx's "Ready to sell" signal
  const ready = typeof counts.products === 'number' && isReadyToSell(counts.products);
  const label = useCheckStatusLabel(runner);
  // v2's Check everything now: every row's check at once, one toast at most for the press.
  const everything = useManualSync(async () => {
    const results = await Promise.allSettled(rows.flatMap(row => (row.onSyncNow ? [row.onSyncNow()] : [])));
    if (results.some(result => result.status === 'rejected')) throw new Error('A check failed');
  });
  // The Store health area (app/health/_layout.tsx) draws the scroll, the page title and the way back.
  return (
    <View testID="screen-health-database">
      {/* The area's heading draws the page's description (app/health/_layout.tsx). */}
      <View className="gap-4">
        <DatabaseStats counts={counts} storageBytes={storageBytes} waiting={outbox.enabled ? outbox.state.pending : 0} />
        {/* v2 database.tsx: the attention panel follows the stat strip. */}
        <StuckRecordsBanner />
        <RejectedOrdersPanel orders={orders} onRequeue={ids => (outbox.enabled ? outbox.requeue(ids) : Promise.resolve(0))} />
        {/* v2 database.tsx:708-715, a warning Notice (TallyUI has none): v2 notice band, warning tone. */}
        {offline && <View testID="db-offline-notice" className="rounded-lg border border-warning/45 bg-warning/15 px-3 py-2.5">
          <Text testID="db-offline-notice-title" className="font-medium text-foreground">{ready
            ? "You're offline. Sales keep working — anything you make is stored here and delivered when your server is back."
            : "You're offline and still setting up — this till can't sell until its catalog finishes downloading."}</Text>
        </View>}
        <DatabaseCounts rows={rows} onCount={onCount} />
        <QueuedEmailsPanel collection={receiptEmails} orders={orders} />
        {/* v2 database.tsx:815-863, the Freshness station. Last check and a failed check wait on a last-tick value from
            @tallyui/database, so the line reads as Logs' does; the totals line needs the connector. */}
        <View testID="db-freshness" className="flex-row flex-wrap items-end justify-between gap-3 pt-1">
          <View testID="db-freshness-lines" className="gap-0.5">
            {runner && <View testID="db-freshness-status" className="flex-row items-center gap-1.5">
              <View aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
              <Text testID="db-freshness-label" className="text-xs text-muted-foreground">{label}</Text>
            </View>}
            {/* v2 database.tsx:559-572: indented to sit in the text column, under the status lines. */}
            <DocsLink testID="db-how-syncing-works" href={HOW_SYNCING_WORKS_DOCS_URL} className="mt-0.5 ml-3">How syncing works</DocsLink>
          </View>
          <Button testID="db-check-everything" variant="outline" size="sm" className="ml-auto" disabled={everything.syncing}
            onPress={() => void everything.sync()}>
            {everything.syncing && <Loader size="sm" />}<Text>Check everything now</Text>
          </Button>
        </View>
      </View>
    </View>
  );
}
