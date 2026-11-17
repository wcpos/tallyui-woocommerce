import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase, type RxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { logRecordMigrationStrategies, logRecordSchema, type LogCollection } from '../lib/logs/log-store';
import { markLogsRead, UnreadLogsProvider, useUnreadLogsCount } from '../lib/logs/unread-errors';
import { memoryStorage } from './memory-storage';

const catalogueState = vi.hoisted(() => ({ logs: undefined as LogCollection | undefined }));
vi.mock('../lib/auth/session-context', () => ({
  useSession: () => ({ ready: true, session: { site: { home: 'https://shop.test', name: 'Shop' } } }),
}));
vi.mock('../lib/catalogue/catalogue-context', () => ({
  useCatalogue: () => ({ catalogue: { logs: catalogueState.logs }, error: undefined }),
}));

addRxPlugin(RxDBMigrationSchemaPlugin);
const site = 'https://shop.test';
let db: RxDatabase;
let collection: LogCollection;

beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  db = await createRxDatabase({ name: `unread_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ logs: collection } = await db.addCollections<{ logs: LogCollection }>({
    logs: { schema: logRecordSchema, migrationStrategies: logRecordMigrationStrategies } }));
  catalogueState.logs = collection;
});
afterEach(async () => { cleanup(); await db.close(); vi.unstubAllGlobals(); });

function Probe() {
  return <span data-testid="count">{useUnreadLogsCount()}</span>;
}

test("UnreadLogsProvider publishes the signed-in site's unread error count from the catalogue's logs", async () => {
  markLogsRead(site, 2000);
  await collection.insert({ id: 'old', timestamp: 1000, level: 'error', scope: 'test', message: 'm' });
  await collection.insert({ id: 'new', timestamp: 3000, level: 'error', scope: 'test', message: 'm' });
  await collection.insert({ id: 'warn', timestamp: 3000, level: 'warn', scope: 'test', message: 'm' });
  render(<UnreadLogsProvider><Probe /></UnreadLogsProvider>);
  await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
});
