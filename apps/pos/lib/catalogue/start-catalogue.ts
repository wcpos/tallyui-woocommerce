import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { ServerCapabilities, SyncContext, TallyConnector } from '@tallyui/core';
import { createTallyDatabase, startCatalogueReconcile, startReplication } from '@tallyui/database';
import type { TallyDatabase, TallyReplicationState } from '@tallyui/database';
import type { RxCollection } from 'rxdb';
import { appStorage } from '../app-storage';
import type { Session } from '../auth/session';
import { fetchCashierCapabilities, type CashierCapabilities } from '../auth/capabilities';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../sale/parked-carts';
import { receiptEmailSchema, type ReceiptEmailCollection } from '../receipts/receipt-emails';
import { fetchStoreInfo } from './store-info';
import type { StoreInfo } from './store-info';

// Reconcile is the coupons' only source: start at once so a coupon made in WooCommerce reaches the till within 15 minutes.
const COUPON_RECONCILE_INTERVAL_MS = 15 * 60_000;

export interface Catalogue {
  db: TallyDatabase;
  coupons: RxCollection;
  parkedCarts: ParkedCartCollection;
  receiptEmails: ReceiptEmailCollection;
  connector: TallyConnector;
  store: StoreInfo;
  cashier: CashierCapabilities;
  capabilities?: ServerCapabilities;
  replication: TallyReplicationState<any>;
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
  const context: SyncContext = {
    connectorId: connector.id,
    baseUrl: session.site.wcposApiUrl,
    headers: { ...connector.auth.getHeaders({ token: session.tokens.accessToken }) },
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
  const { parked_carts: parkedCarts, receipt_emails: receiptEmails } = await db.addCollections<{
    parked_carts: ParkedCartCollection; receipt_emails: ReceiptEmailCollection;
  }>({
    parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    receipt_emails: { schema: receiptEmailSchema },
  });
  const replication = startReplication({ collection: db.products, adapter: connector.replication!.products!, context });
  const couponReplication = startReplication({ collection: db.coupons, adapter: connector.replication!.coupons!, context });
  const reconcile = startCatalogueReconcile({
    collection: db.products, adapter: connector.reconcile!.catalogue!, context,
    reSync: () => replication.reSync(),
  });
  const couponReconcile = startCatalogueReconcile({
    collection: db.coupons, adapter: connector.reconcile!.coupons!, context,
    reSync: () => couponReplication.reSync(), stateId: 'coupons-reconcile',
    startDelayMs: 0, intervalMs: COUPON_RECONCILE_INTERVAL_MS,
  });
  return {
    db, coupons: db.coupons, parkedCarts, receiptEmails, connector, store, cashier, capabilities, replication,
    setAccessToken(token) {
      Object.assign(context.headers, connector.auth.getHeaders({ token }));
      void replication.resume();
      void couponReplication.resume();
    },
    async stop() {
      reconcile.stop();
      couponReconcile.stop();
      await replication.cancel();
      await couponReplication.cancel();
      await db.close();
    },
  };
}
