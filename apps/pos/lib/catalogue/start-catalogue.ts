import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { SyncContext, TallyConnector } from '@tallyui/core';
import { createTallyDatabase, startCatalogueReconcile, startReplication } from '@tallyui/database';
import type { TallyDatabase, TallyReplicationState } from '@tallyui/database';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { Session } from '../auth/session';
import { fetchStoreInfo } from './store-info';
import type { StoreInfo } from './store-info';

export interface Catalogue {
  db: TallyDatabase;
  connector: TallyConnector;
  store: StoreInfo;
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
  const db = await createTallyDatabase({
    connector, name: databaseName(session),
    // In-memory until the SQLite-wasm job (ADR 0004).
    storage: options.storage ?? getRxStorageMemory(),
  });
  const replication = startReplication({ collection: db.products, adapter: connector.replication!.products!, context });
  const reconcile = startCatalogueReconcile({
    collection: db.products, adapter: connector.reconcile!.catalogue!, context,
    reSync: () => replication.reSync(),
  });
  return {
    db, connector, store, replication,
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
