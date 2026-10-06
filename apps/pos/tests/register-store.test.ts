import { expect, test } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import type { RxJsonSchema } from 'rxdb';
import { RxDBLocalDocumentsPlugin } from 'rxdb/plugins/local-documents';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { bindRegister, ensureRegister, getBoundRegisterId, readRegister } from '@tallyui/pos';
import { openOrderStore } from '../lib/sale/order-store';

const id = { type: 'string', maxLength: 36 } as const;
const text = { type: 'string' } as const;
const nullableText = { type: ['string', 'null'] } as const;
const minor = { type: 'integer' } as const;
const nullableMinor = { type: ['integer', 'null'] } as const;
const registerSessionSchemaV0 = {
  title: 'Register sessions', version: 0, primaryKey: 'id', type: 'object', additionalProperties: false,
  properties: {
    id, register_id: id, store_key: nullableText,
    status: { type: 'string', enum: ['open', 'counting', 'closed'], maxLength: 8 },
    business_day: { type: 'string', maxLength: 10 },
    opened_at_gmt: text, opened_by: nullableText,
    expected_float_minor: nullableMinor, counted_float_minor: minor, opening_variance_minor: nullableMinor,
    counting_started_at_gmt: nullableText, closed_at_gmt: nullableText, closed_by: nullableText,
    approval_required: { type: 'boolean', default: false }, approved_by: nullableText,
    counted: { type: ['object', 'null'], additionalProperties: minor },
    closure_id: nullableText,
    pending_status: { ...nullableText, default: null },
    server_status: { ...nullableText, default: null },
    status_at: { ...nullableText, default: null },
    approver_token: { ...nullableText, default: null },
    server_expected: { type: ['object', 'null'], additionalProperties: minor, default: null },
    server_sales_count: { type: ['integer', 'null'], default: null },
  },
  required: ['id', 'register_id', 'status', 'opened_at_gmt', 'counted_float_minor'],
  indexes: [['register_id', 'status']],
} as RxJsonSchema<any>;

test('register collections and the local register survive reopening with their binding', async () => {
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const storage = getRxStorageMemory();
  const first = await openOrderStore(name, storage);
  let registerId: string;
  try {
    const collections = first.orders.database.collections;
    expect(Object.keys(collections).sort()).toEqual(['cash_movements', 'closures', 'pos_orders', 'register_sessions', 'tender_voids']);
    const doc = await readRegister(collections.register_sessions);
    expect(doc).toMatchObject({ id: expect.any(String), platform: 'web', stores: {} });
    registerId = doc!.id;
    await bindRegister(collections.register_sessions, name, { id: doc!.id, name: doc!.name });
  } finally {
    await first.close();
  }
  const reopened = await openOrderStore(name, storage);
  try {
    const doc = await readRegister(reopened.orders.database.collections.register_sessions);
    expect(doc!.id).toBe(registerId);
    expect(getBoundRegisterId(doc, name)).toBe(registerId);
  } finally {
    await reopened.close();
  }
});

test('a version 0 register_sessions database from the 3.6.0 app migrates and keeps its sessions and register', async () => {
  addRxPlugin(RxDBLocalDocumentsPlugin);
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const storage = getRxStorageMemory();
  const db = await createRxDatabase({ name, storage, multiInstance: false });
  await db.addCollections({
    register_sessions: { schema: registerSessionSchemaV0, localDocuments: true },
  });
  const doc = await ensureRegister(db.register_sessions, 'web');
  await bindRegister(db.register_sessions, name, { id: doc.id, name: doc.name });
  await db.register_sessions.insert({
    id: 'session-1', register_id: doc.id, status: 'closed',
    opened_at_gmt: '2026-10-01T09:00:00Z', counted_float_minor: 5000,
    closed_at_gmt: '2026-10-01T17:00:00Z', counted: { cash: 12345 },
  });
  await db.close();

  const store = await openOrderStore(name, storage);
  try {
    const sessions = store.orders.database.collections.register_sessions;
    expect(sessions.schema.version).toBe(1);
    const session = await sessions.findOne('session-1').exec();
    expect(session?.toJSON()).toMatchObject({
      status: 'closed', counted_float_minor: 5000, counted: { cash: 12345 },
      closed_at_gmt: '2026-10-01T17:00:00Z', server_session_id: null,
    });
    const register = await readRegister(sessions);
    expect(register!.id).toBe(doc.id);
    expect(getBoundRegisterId(register, name)).toBe(doc.id);
  } finally {
    await store.close();
  }
});
