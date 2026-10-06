import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { ServerCapabilities, SyncContext, TallyConnector } from '@tallyui/core';
import { createTallyDatabase, startCatalogueReconcile, startReplication } from '@tallyui/database';
import type { TallyDatabase, TallyReplicationState } from '@tallyui/database';
import { appStorage } from '../app-storage';
import type { Session } from '../auth/session';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../sale/parked-carts';
import { receiptEmailSchema, type ReceiptEmailCollection } from '../receipts/receipt-emails';
import { fetchStoreInfo } from './store-info';
import type { StoreInfo } from './store-info';

export interface Catalogue {
  db: TallyDatabase;
  parkedCarts: ParkedCartCollection;
  receiptEmails: ReceiptEmailCollection;
  connector: TallyConnector;
  store: StoreInfo;
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
  const reconcile = startCatalogueReconcile({
    collection: db.products, adapter: connector.reconcile!.catalogue!, context,
    reSync: () => replication.reSync(),
  });
  return {
    db, parkedCarts, receiptEmails, connector, store, capabilities, replication,
    setAccessToken(token) {
      Object.assign(context.headers, connector.auth.getHeaders({ token }));
      void replication.resume();
    },
    async stop() {
      reconcile.stop();
      await replication.cancel();
      await db.close();
    },
  };
}
