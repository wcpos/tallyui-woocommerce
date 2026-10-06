import { expect, test } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { bindRegister, getBoundRegisterId, readRegister } from '@tallyui/pos';
import { openOrderStore } from '../lib/sale/order-store';

test('register collections and the local register survive reopening with their binding', async () => {
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const storage = getRxStorageMemory();
  const first = await openOrderStore(name, storage);
  let registerId: string;
  try {
    const collections = first.orders.database.collections;
    expect(Object.keys(collections).sort()).toEqual(['cash_movements', 'closures', 'pos_orders', 'register_sessions']);
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
