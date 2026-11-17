import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase, type RxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { logRecordMigrationStrategies, logRecordSchema, type LogCollection } from '../lib/logs/log-store';
import { loadLogsLastViewed, markLogsRead, useUnreadErrorCount } from '../lib/logs/unread-errors';
import { memoryStorage } from './memory-storage';

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
});
afterEach(async () => { cleanup(); await db.close(); vi.unstubAllGlobals(); });

test('a first run marks the logs read up to now, so older errors show no badge', async () => {
  await collection.insert({ id: 'old', timestamp: 1000, level: 'error', scope: 'test', message: 'm' });
  const { result } = renderHook(() => useUnreadErrorCount(collection, site, () => 5000));
  await waitFor(() => expect(loadLogsLastViewed(site)).toBe(5000));
  expect(result.current).toBe(0);
});

test('counts only error rows newer than the last-viewed mark', async () => {
  markLogsRead(site, 2000);
  for (const [id, timestamp, level] of [
    ['old', 1000, 'error'], ['new', 3000, 'error'], ['warn', 3000, 'warn'], ['info', 4000, 'info'], ['later', 4000, 'error'],
  ] as const) await collection.insert({ id, timestamp, level, scope: 'test', message: 'm' });
  const { result } = renderHook(() => useUnreadErrorCount(collection, site));
  await waitFor(() => expect(result.current).toBe(2));
});

test('opening Logs clears the count and later errors count again', async () => {
  markLogsRead(site, 2000);
  for (const [id, timestamp, level] of [
    ['old', 1000, 'error'], ['new', 3000, 'error'], ['warn', 3000, 'warn'], ['info', 4000, 'info'], ['later', 4000, 'error'],
  ] as const) await collection.insert({ id, timestamp, level, scope: 'test', message: 'm' });
  const { result } = renderHook(() => useUnreadErrorCount(collection, site));
  await waitFor(() => expect(result.current).toBe(2));
  act(() => markLogsRead(site, 5000));
  await waitFor(() => expect(result.current).toBe(0));
  await act(async () => { await collection.insert({ id: 'latest', timestamp: 6000, level: 'error', scope: 'test', message: 'm' }); });
  await waitFor(() => expect(result.current).toBe(1));
});

test('the mark is kept per site', () => {
  markLogsRead('https://a.test', 100);
  expect(loadLogsLastViewed('https://b.test')).toBeUndefined();
  expect(loadLogsLastViewed('https://a.test')).toBe(100);
});

test('no site or no logs collection gives 0', async () => {
  await collection.insert({ id: 'error', timestamp: 1000, level: 'error', scope: 'test', message: 'm' });
  const withoutLogs = renderHook(() => useUnreadErrorCount(undefined, site));
  const withoutSite = renderHook(() => useUnreadErrorCount(collection, undefined));
  expect(withoutLogs.result.current).toBe(0);
  expect(withoutSite.result.current).toBe(0);
});
