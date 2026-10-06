import { afterEach, expect, test, vi } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { Payment } from '@tallyui/pos';
import { openOrderStore } from '../lib/sale/order-store';
import { recordTenderVoids, TENDER_VOID_WRITE_ONCE, type TenderVoidContext } from '../lib/sale/tender-voids';

const payments: Payment[] = [
  { id: 'p1', method: 'cash', amountMinor: 200, tenderedMinor: 500 },
  { id: 'p2', method: 'external', amountMinor: 100, reference: 'T-1' },
];
const context: TenderVoidContext = {
  saleId: 'sale-1', currency: 'USD', reason: 'removed', registerId: 'web', cashierRef: '2',
  deviceTime: '2026-10-06T10:00:00.000Z', deviceTz: 'Europe/Madrid',
};

afterEach(() => vi.restoreAllMocks());

test.each([undefined, 'session-1'])('records complete rows with sessionId=%s in one insert', async sessionId => {
  const store = await openOrderStore(`tallywoo_orders_${crypto.randomUUID()}`, getRxStorageMemory());
  try {
    const collection = store.orders.database.collections.tender_voids;
    const insert = vi.spyOn(collection, 'bulkInsert');
    const provenance = { ...context, ...(sessionId !== undefined ? { sessionId } : {}) };
    await recordTenderVoids(collection, payments, provenance);
    expect(insert).toHaveBeenCalledTimes(1);
    const rows = (await collection.find().exec()).map(doc => doc.toJSON());
    expect(rows).toHaveLength(2);
    expect(rows.sort((left, right) => left.paymentId.localeCompare(right.paymentId))).toStrictEqual([
      { ...provenance, paymentId: 'p1', type: 'void', method: 'cash', amountMinor: 200, tenderedMinor: 500 },
      { ...provenance, paymentId: 'p2', type: 'void', method: 'external', amountMinor: 100, reference: 'T-1' },
    ]);
  } finally {
    await store.close();
  }
});

test('replaying a payment keeps the original time and reason', async () => {
  const store = await openOrderStore(`tallywoo_orders_${crypto.randomUUID()}`, getRxStorageMemory());
  try {
    const collection = store.orders.database.collections.tender_voids;
    await recordTenderVoids(collection, [payments[0]], context);
    await expect(recordTenderVoids(collection, [payments[0]], {
      ...context, deviceTime: '2026-10-06T11:00:00.000Z', reason: 'cancelled',
    })).resolves.toBeUndefined();
    const rows = await collection.find().exec();
    expect(rows).toHaveLength(1);
    expect(rows[0].toJSON()).toEqual({
      ...context, paymentId: 'p1', type: 'void', method: 'cash', amountMinor: 200, tenderedMinor: 500,
    });
  } finally {
    await store.close();
  }
});

test.each(['patch', 'remove'] as const)('%s cannot change or delete a recorded void', async operation => {
  const store = await openOrderStore(`tallywoo_orders_${crypto.randomUUID()}`, getRxStorageMemory());
  try {
    const collection = store.orders.database.collections.tender_voids;
    await recordTenderVoids(collection, [payments[0]], context);
    const doc = (await collection.findOne('p1').exec())!;
    const original = doc.toJSON();
    await expect(operation === 'patch' ? doc.patch({ amountMinor: 0 }) : doc.remove()).rejects.toThrow(TENDER_VOID_WRITE_ONCE);
    expect((await collection.findOne('p1').exec())?.toJSON()).toEqual(original);
  } finally {
    await store.close();
  }
});

test('a non-conflict insert failure rejects and identifies the first failure', async () => {
  const store = await openOrderStore(`tallywoo_orders_${crypto.randomUUID()}`, getRxStorageMemory());
  try {
    const collection = store.orders.database.collections.tender_voids;
    vi.spyOn(collection, 'bulkInsert').mockResolvedValueOnce({ success: [], error: [
      { status: 409, documentId: 'already-recorded' },
      { status: 422, documentId: 'p1' },
      { status: 500, documentId: 'p2' },
    ] } as any);
    await expect(recordTenderVoids(collection, payments, context)).rejects.toThrow('Tender void p1 failed with status 422');
  } finally {
    await store.close();
  }
});

test('voids persist when the store is reopened with the same memory storage', async () => {
  const storage = getRxStorageMemory();
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const store = await openOrderStore(name, storage);
  try {
    await recordTenderVoids(store.orders.database.collections.tender_voids, payments, context);
  } finally {
    await store.close();
  }
  const reopened = await openOrderStore(name, storage);
  try {
    const rows = await reopened.orders.database.collections.tender_voids.find().exec();
    expect(rows.map(doc => doc.toJSON())).toEqual(expect.arrayContaining([
      { ...context, paymentId: 'p1', type: 'void', method: 'cash', amountMinor: 200, tenderedMinor: 500 },
      { ...context, paymentId: 'p2', type: 'void', method: 'external', amountMinor: 100, reference: 'T-1' },
    ]));
    expect(rows).toHaveLength(2);
  } finally {
    await reopened.close();
  }
});
