import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase, type RxDatabase, type RxJsonSchema } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { outboxLogger, taxLogger } from '@tallyui/pos';
import { attachLogStore, logRecordMigrationStrategies, logRecordSchema, toLogRecord, withoutWriteParameters,
  type LogCollection, type LogRecord } from '../lib/logs/log-store';
import { setVerboseDiagnostics } from '../lib/logs/verbose';
import { memoryStorage } from './memory-storage';

addRxPlugin(RxDBMigrationSchemaPlugin);

let db: RxDatabase;
let collection: LogCollection;
let store: ReturnType<typeof attachLogStore>;

beforeEach(async () => {
  vi.stubGlobal('localStorage', memoryStorage());
  db = await createRxDatabase({ name: `logs_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ logs: collection } = await db.addCollections<{ logs: LogCollection }>({
    logs: { schema: logRecordSchema, migrationStrategies: logRecordMigrationStrategies } }));
  store = attachLogStore(collection, { loggers: [taxLogger, outboxLogger] });
});

afterEach(async () => {
  await store.detach();
  await db.close();
  vi.unstubAllGlobals();
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

test('stores debug entries only while verbose diagnostics is on; info, warn and error always', async () => {
  taxLogger.debug('noise');
  taxLogger.info('i1');
  taxLogger.warn('w1');
  outboxLogger.error('e1');
  await store.flush();
  expect((await collection.find({ sort: [{ id: 'asc' }] }).exec()).map(row => row.message)).toEqual(['i1', 'w1', 'e1']);
  setVerboseDiagnostics(true);
  taxLogger.debug('verbose');
  taxLogger.info('i2');
  await store.flush();
  setVerboseDiagnostics(false);
  taxLogger.debug('noise again');
  await store.flush();
  const rows = (await collection.find({ sort: [{ id: 'asc' }] }).exec()).map(row => row.toJSON());
  expect(rows.map(row => row.message)).toEqual(['i1', 'w1', 'e1', 'verbose', 'i2']);
  expect(rows[3].level).toBe('debug');
});

test('keeps only the newest cap rows', async () => {
  await store.detach();
  store = attachLogStore(collection, { cap: 3, loggers: [taxLogger, outboxLogger] });
  for (let i = 1; i <= 5; i++) taxLogger.warn(`w${i}`);
  await store.flush();
  expect((await collection.find({ sort: [{ id: 'asc' }] }).exec()).map(row => row.message)).toEqual(['w3', 'w4', 'w5']);
});

test('a failed write warns on the console and the next entry is still stored', async () => {
  const failure = new Error('disk full');
  const insert = vi.spyOn(collection, 'insert').mockRejectedValueOnce(failure);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    taxLogger.warn('lost');
    taxLogger.warn('kept');
    await store.flush();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('[tallywoo] could not store a log entry', failure);
    expect(insert).toHaveBeenCalledTimes(2);
    expect((await collection.find().exec()).map(row => row.message)).toEqual(['kept']);
  } finally {
    insert.mockRestore();
    warn.mockRestore();
  }
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

test('toLogRecord keeps an actor that names an id or a name, with only its string fields', () => {
  const entry = { timestamp: 1, level: 'info' as const, scope: 'register-facts', message: 'Drawer opened' };
  const extra = { email: 'jane@example.com' } as object;
  expect(toLogRecord({ ...entry, actor: { id: '7', role: 'cashier', ...extra } }, 'a').actor)
    .toEqual({ id: '7', role: 'cashier' });
  expect(toLogRecord({ ...entry, actor: { name: 'Jane' } }, 'b').actor).toEqual({ name: 'Jane' });
  expect(toLogRecord({ ...entry, actor: { id: '', name: '' } }, 'c')).not.toHaveProperty('actor');
  expect(toLogRecord(entry, 'd')).not.toHaveProperty('actor');
});

test('toLogRecord keeps a syncRecord with its reason cleaned of RxDB write parameters', () => {
  const reason = 'Document update conflict.\n' + '-'.repeat(20) + '\nParameters:\n{"billing":{"email":"jane@example.com"}}';
  const row = toLogRecord({ timestamp: 1, level: 'warn', scope: 'outbox', message: 'Order refused',
    syncRecord: { collection: 'pos_orders', recordId: 'o1', outcome: 'failed', code: 'refused', reason,
      ...({ extra: 'x' } as object) } }, 'x');
  expect(row.syncRecord).toEqual({ collection: 'pos_orders', recordId: 'o1', outcome: 'failed', code: 'refused',
    reason: 'Document update conflict.' });
  expect(toLogRecord({ timestamp: 1, level: 'info', scope: 'outbox', message: 'Sent',
    syncRecord: { collection: 'pos_orders', recordId: 'o1', outcome: 'ok' } }, 'y').syncRecord)
    .toEqual({ collection: 'pos_orders', recordId: 'o1', outcome: 'ok' });
});

test('a version 0 log row survives the move to version 1, which then stores actor and syncRecord', async () => {
  const v0Schema: RxJsonSchema<Omit<LogRecord, 'actor' | 'syncRecord'>> = {
    version: 0, primaryKey: 'id', type: 'object',
    properties: {
      id: { type: 'string', maxLength: 32 },
      timestamp: { type: 'integer', minimum: 0 },
      level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
      scope: { type: 'string' }, message: { type: 'string' },
      code: { type: 'string' }, outcome: { type: 'string' }, detail: { type: 'string' },
      durationMs: { type: 'number', minimum: 0 },
    },
    required: ['id', 'timestamp', 'level', 'scope', 'message'],
  };
  const storage = wrappedValidateAjvStorage({ storage: getRxStorageMemory() });
  const options = { name: `logs_migration_${crypto.randomUUID()}`, multiInstance: false, storage };
  const old: LogRecord = { id: 'old', timestamp: 1, level: 'error', scope: 'outbox', message: 'Refused',
    code: 'refused', durationMs: 12, detail: '{}' };
  const oldDb = await createRxDatabase(options);
  try {
    const { logs } = await oldDb.addCollections({ logs: { schema: v0Schema } });
    await logs.insert(old);
  } finally {
    await oldDb.close();
  }
  const newDb = await createRxDatabase(options);
  try {
    const { logs } = await newDb.addCollections<{ logs: LogCollection }>({
      logs: { schema: logRecordSchema, migrationStrategies: logRecordMigrationStrategies } });
    expect((await logs.find().exec()).map(doc => doc.toJSON())).toEqual([old]);
    const row: LogRecord = { id: 'new', timestamp: 2, level: 'info', scope: 'outbox', message: 'Sent',
      actor: { id: '7', name: 'Jane', role: 'cashier' },
      syncRecord: { collection: 'pos_orders', recordId: 'o1', outcome: 'pending', code: 'x', reason: 'Retrying' } };
    await logs.insert(row);
    expect((await logs.findOne('new').exec())?.toJSON()).toEqual(row);
  } finally {
    await newDb.close();
  }
});
