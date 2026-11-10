import { afterEach, beforeEach, expect, test } from 'vitest';
import { createRxDatabase, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { outboxLogger, taxLogger } from '@tallyui/pos';
import { attachLogStore, logRecordSchema, toLogRecord, withoutWriteParameters, type LogCollection } from '../lib/logs/log-store';

let db: RxDatabase;
let collection: LogCollection;
let store: ReturnType<typeof attachLogStore>;

beforeEach(async () => {
  db = await createRxDatabase({ name: `logs_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ logs: collection } = await db.addCollections<{ logs: LogCollection }>({ logs: { schema: logRecordSchema } }));
  store = attachLogStore(collection, { loggers: [taxLogger, outboxLogger] });
});

afterEach(async () => {
  await store.detach();
  await db.close();
});

test('writes warn and error entries from the TallyUI loggers with code, duration and the error message', async () => {
  taxLogger.warn('Tax class missing', { taxClass: 'reduced' });
  outboxLogger.error('Order refused', { code: 'woocommerce_rest_invalid', durationMs: 1200, cause: new Error('boom') });
  await store.flush();
  const rows = await collection.find({ sort: [{ id: 'asc' }] }).exec();
  expect(rows).toHaveLength(2);
  expect(rows[0].toJSON()).toMatchObject({ scope: 'tax', level: 'warn', message: 'Tax class missing' });
  expect(rows[0].code).toBeUndefined();
  expect(rows[0].durationMs).toBeUndefined();
  expect(rows[1].toJSON()).toMatchObject({ scope: 'outbox', level: 'error', message: 'Order refused',
    code: 'woocommerce_rest_invalid', durationMs: 1200 });
  expect(rows[1].detail).toContain('"message":"boom"');
});

test('ignores debug entries', async () => {
  taxLogger.debug('noise');
  taxLogger.warn('kept');
  await store.flush();
  expect((await collection.find().exec()).map(row => row.message)).toEqual(['kept']);
});

test('keeps only the newest cap rows', async () => {
  await store.detach();
  store = attachLogStore(collection, { cap: 3, loggers: [taxLogger, outboxLogger] });
  for (let i = 1; i <= 5; i++) taxLogger.warn(`w${i}`);
  await store.flush();
  expect((await collection.find({ sort: [{ id: 'asc' }] }).exec()).map(row => row.message)).toEqual(['w3', 'w4', 'w5']);
});

test('stops writing after detach', async () => {
  taxLogger.warn('before');
  await store.flush();
  await store.detach();
  taxLogger.warn('late');
  await new Promise(resolve => setTimeout(resolve, 20));
  expect((await collection.find().exec()).map(row => row.message)).toEqual(['before']);
});

test('stores unserializable data as a marker', async () => {
  const data: Record<string, unknown> = {};
  data.self = data;
  taxLogger.warn('circular', data);
  await store.flush();
  expect((await collection.find().exec())[0].detail).toBe('[unserializable]');
});

test('keeps RxDB write parameters out of the detail', () => {
  const error = Object.assign(new Error('\nDocument update conflict.\n' + '-'.repeat(20)
    + '\nParameters:\nwriteRow: {"billing":{"email":"jane@example.com"}}\n'), { code: 'CONFLICT' });
  const row = toLogRecord({ timestamp: 1, level: 'error', scope: 'outbox', message: 'Failed',
    data: { cause: error, error: String(error) } }, 'x');
  expect(row.detail).not.toContain('jane@example.com');
  expect(row.detail).not.toContain('Parameters:');
  expect(row.detail).toContain('Document update conflict.');
  expect(row.detail).toContain('CONFLICT');
});

test('withoutWriteParameters leaves ordinary text alone', () => {
  expect(withoutWriteParameters('Network request failed')).toBe('Network request failed');
});
