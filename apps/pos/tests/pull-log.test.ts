import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Logger } from '@tallyui/pos';
import { BehaviorSubject, Subject, type Subscription } from 'rxjs';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { attachLogStore, logRecordMigrationStrategies, logRecordSchema, syncLogger, TALLYUI_LOGGERS,
  type LogCollection, type LogRecord } from '../lib/logs/log-store';
import { matchesLogFilter } from '../lib/logs/log-view';
import { logPulledBatches } from '../lib/logs/pull-log';

addRxPlugin(RxDBMigrationSchemaPlugin);

let received$: Subject<unknown>;
let active$: BehaviorSubject<boolean>;
let logger: Logger;
let subscription: Subscription;
let t = 0;
const now = () => t;

beforeEach(() => {
  t = 0;
  received$ = new Subject<unknown>();
  active$ = new BehaviorSubject<boolean>(false);
  logger = { info: vi.fn() } as unknown as Logger;
  subscription = logPulledBatches({ received$, active$ }, 'products', { logger, now });
});

afterEach(() => subscription.unsubscribe());

test('logs one sync row per pulled batch with the record count and the time taken', () => {
  t = 1000;
  active$.next(true);
  for (let i = 0; i < 3; i++) received$.next({});
  t = 1340;
  active$.next(false);
  active$.next(false);
  expect(logger.info).toHaveBeenCalledTimes(1);
  expect(logger.info).toHaveBeenCalledWith('Saved updates from your store · 3 records',
    { collection: 'products', count: 3, durationMs: 340 });
});

test('says record for a batch of one', () => {
  active$.next(true);
  received$.next({});
  active$.next(false);
  expect(logger.info).toHaveBeenCalledTimes(1);
  expect(logger.info).toHaveBeenCalledWith('Saved updates from your store · 1 record',
    { collection: 'products', count: 1, durationMs: 0 });
});

test('logs nothing for a pass that received nothing or for the first false', () => {
  expect(logger.info).not.toHaveBeenCalled();
  received$.next({});
  active$.next(true);
  active$.next(false);
  expect(logger.info).not.toHaveBeenCalled();
});

test('logs each batch on its own', () => {
  t = 1000;
  active$.next(true);
  received$.next({});
  t = 1100;
  active$.next(true);
  received$.next({});
  t = 1340;
  active$.next(false);
  t = 2000;
  active$.next(true);
  for (let i = 0; i < 5; i++) received$.next({});
  t = 2500;
  active$.next(false);
  expect(logger.info).toHaveBeenCalledTimes(2);
  expect(logger.info).toHaveBeenNthCalledWith(1, 'Saved updates from your store · 2 records',
    { collection: 'products', count: 2, durationMs: 340 });
  expect(logger.info).toHaveBeenNthCalledWith(2, 'Saved updates from your store · 5 records',
    { collection: 'products', count: 5, durationMs: 500 });
});

test('stops logging once unsubscribed', () => {
  active$.next(true);
  received$.next({});
  subscription.unsubscribe();
  received$.next({});
  active$.next(false);
  expect(logger.info).not.toHaveBeenCalled();
});

test('the Sync filter finds the store-sync rows', () => {
  const row: LogRecord = { id: 'x', timestamp: 0, level: 'info', scope: 'sync',
    message: 'Saved updates from your store · 3 records' };
  expect(matchesLogFilter(row, 'sync')).toBe(true);
  expect(matchesLogFilter(row, 'errors')).toBe(false);
});

test('the log store listens to the sync logger', async () => {
  expect(TALLYUI_LOGGERS).toContain(syncLogger);
  const db = await createRxDatabase({ name: `logs_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  const { logs: collection } = await db.addCollections<{ logs: LogCollection }>({
    logs: { schema: logRecordSchema, migrationStrategies: logRecordMigrationStrategies } });
  const store = attachLogStore(collection, { loggers: [syncLogger] });
  try {
    syncLogger.info('Saved updates from your store · 3 records', { collection: 'products', count: 3, durationMs: 340 });
    await store.flush();
    const rows = await collection.find().exec();
    expect(rows).toHaveLength(1);
    expect(rows[0].toJSON()).toMatchObject({ scope: 'sync', level: 'info',
      message: 'Saved updates from your store · 3 records', durationMs: 340 });
  } finally {
    await store.detach();
    await db.close();
  }
});
