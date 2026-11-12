import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { ServerCapabilities, SyncContext, TallyConnector } from '@tallyui/core';
import {
  createRequestMetrics, createTallyDatabase, meteredFetch, persistRequestMetrics, readSyncCadence,
  REQUEST_METRICS_COLLECTION, requestMetricsCollection, startCatalogueReconcile, startReplication,
  startSyncCadence, SYNC_CADENCE_COLLECTION, syncCadence$, syncCadenceCollection,
} from '@tallyui/database';
import type {
  RequestMetrics, RequestMetricsCollection, SyncCadenceCollection, SyncCadenceRunner, TallyDatabase,
  TallyReplicationState,
} from '@tallyui/database';
import type { RxCollection } from 'rxdb';
import { addPrinterProfileCollection, type PrinterProfileCollection } from '@tallyui/pos';
import { appStorage } from '../app-storage';
import type { Session } from '../auth/session';
import { fetchCashierCapabilities, type CashierCapabilities } from '../auth/capabilities';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../sale/parked-carts';
import { receiptEmailSchema, receiptEmailMigrationStrategies, type ReceiptEmailCollection } from '../receipts/receipt-emails';
import { attachLogStore, logRecordMigrationStrategies, logRecordSchema, type LogCollection } from '../logs/log-store';
import { fetchStoreInfo } from './store-info';
import type { StoreInfo } from './store-info';

// Reconcile is the coupons' only source: start at once so a coupon made in WooCommerce reaches the till within 15 minutes.
const COUPON_RECONCILE_INTERVAL_MS = 15 * 60_000;

export interface Catalogue {
  db: TallyDatabase;
  coupons: RxCollection;
  parkedCarts: ParkedCartCollection;
  receiptEmails: ReceiptEmailCollection;
  logs: LogCollection;
  printerProfiles: PrinterProfileCollection;
  connector: TallyConnector;
  store: StoreInfo;
  cashier: CashierCapabilities;
  capabilities?: ServerCapabilities;
  replication: TallyReplicationState<any>;
  // Hourly request buckets of this device.
  requestMetrics: RequestMetrics;
  // The sync_cadence collection; D10c writes it.
  syncCadence: SyncCadenceCollection;
  // The polling runner; D10c reads nextDueAtMs$.
  cadence: SyncCadenceRunner;
  setAccessToken(token: string): void;
  stop(): Promise<void>;
}

export function databaseName(session: Session): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < session.site.home.length; i++) {
    hash = Math.imul(hash ^ session.site.home.charCodeAt(i), 0x01000193);
  }
  return `tallywoo_${(hash >>> 0).toString(16)}_${session.tokens.user.id}`;
}

export async function startCatalogue(
  session: Session, options: { storage?: unknown; fetchImpl?: typeof fetch } = {},
): Promise<Catalogue> {
  const connector = createWooCommerceConnector();
  const requestMetrics = createRequestMetrics();
  const context: SyncContext = {
    connectorId: connector.id,
    baseUrl: session.site.wcposApiUrl,
    headers: { ...connector.auth.getHeaders({ token: session.tokens.accessToken }) },
    // WCPOS sends the load as X-Server-Load (v2 engine-fetcher.ts:386). The arrow looks fetch up per request.
    fetch: meteredFetch((input, init) => globalThis.fetch(input, init), requestMetrics, { serverLoadHeader: 'X-Server-Load' }),
  };
  const store = await fetchStoreInfo(session, context.headers, options.fetchImpl);
  const cashier = await fetchCashierCapabilities(session, context.headers, options.fetchImpl);
  const capabilities = await connector.capabilities?.(context);
  const db = await createTallyDatabase({
    connector, name: databaseName(session),
    // SQLite-wasm per ADR 0004; tests pass memory storage explicitly.
    storage: options.storage ?? appStorage(),
  });
  // House rule: local-only collections, never replicated.
  const {
    parked_carts: parkedCarts, receipt_emails: receiptEmails, logs, sync_cadence: syncCadence, request_metrics,
  } = await db.addCollections<{
    parked_carts: ParkedCartCollection; receipt_emails: ReceiptEmailCollection; logs: LogCollection;
    sync_cadence: SyncCadenceCollection; request_metrics: RequestMetricsCollection;
  }>({
    parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    receipt_emails: { schema: receiptEmailSchema, migrationStrategies: receiptEmailMigrationStrategies },
    logs: { schema: logRecordSchema, migrationStrategies: logRecordMigrationStrategies },
    [SYNC_CADENCE_COLLECTION]: syncCadenceCollection(),
    [REQUEST_METRICS_COLLECTION]: requestMetricsCollection(),
  });
  const metricsStore = persistRequestMetrics(requestMetrics, request_metrics);
  const cadenceProfile = await readSyncCadence(syncCadence);
  // Also local only (v2 device-local schema); the Print Dialog stays in memory, never stored.
  const printerProfiles = await addPrinterProfileCollection(db);
  const logStore = attachLogStore(logs);
  // RxDB fixes the page size at start, so a change on the Performance page applies from the next start.
  const { pullBatchSize } = cadenceProfile;
  const replication = startReplication({ collection: db.products, adapter: connector.replication!.products!, context, pullBatchSize });
  const couponReplication = startReplication({
    collection: db.coupons, adapter: connector.replication!.coupons!, context, pullBatchSize,
  });
  const reconcile = startCatalogueReconcile({
    collection: db.products, adapter: connector.reconcile!.catalogue!, context,
    reSync: () => replication.reSync(),
  });
  const couponReconcile = startCatalogueReconcile({
    collection: db.coupons, adapter: connector.reconcile!.coupons!, context,
    reSync: () => couponReplication.reSync(), stateId: 'coupons-reconcile',
    startDelayMs: 0, intervalMs: COUPON_RECONCILE_INTERVAL_MS,
  });
  // Products only, one check per tick, so the page's "~60 requests per hour" holds; coupons keep their
  // 15-minute reconcile. No connectivity tracker: the app passes none to startReplication either.
  const cadence = startSyncCadence({ targets: [replication], cadence$: syncCadence$(syncCadence) });
  return {
    db, coupons: db.coupons, parkedCarts, receiptEmails, logs, printerProfiles,
    connector, store, cashier, capabilities, replication, requestMetrics, syncCadence, cadence,
    setAccessToken(token) {
      Object.assign(context.headers, connector.auth.getHeaders({ token }));
      void replication.resume();
      void couponReplication.resume();
    },
    async stop() {
      await logStore.detach();
      cadence.stop();
      reconcile.stop();
      couponReconcile.stop();
      await replication.cancel();
      await couponReplication.cancel();
      await metricsStore.stop();
      await db.close();
    },
  };
}
