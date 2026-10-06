import { expect, test } from 'vitest';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { Session } from '../lib/auth/session';
import { databaseName } from '../lib/catalogue/start-catalogue';
import { openOrderStore, ordersDatabaseName } from '../lib/sale/order-store';

const session: Session = {
  site: { name: 'Store', home: 'hello', wpApiUrl: '', wcposApiUrl: '', authUrl: '' },
  tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
    user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
};

test('order database names reuse the stable FNV-1a hash with a separate prefix', () => {
  const name = ordersDatabaseName(session);
  expect(name).toBe('tallywoo_orders_4f9f2cab_2');
  expect(name).toBe(ordersDatabaseName(session));
  expect(name).toMatch(/^[a-z][_$a-z0-9-]*$/);
  expect(name).not.toBe(databaseName(session));
  expect(ordersDatabaseName({ ...session, site: { ...session.site, home: 'https://shop.example' } })).not.toBe(name);
  expect(ordersDatabaseName({ ...session, tokens: { ...session.tokens, user: { ...session.tokens.user, id: 3 } } })).not.toBe(name);
});

test('opens pos_orders and register collections in its own memory database and closes it', async () => {
  const name = `tallywoo_orders_${crypto.randomUUID()}`;
  const store = await openOrderStore(name, getRxStorageMemory());
  const db = store.orders.database;
  try {
    expect(db.name).toBe(name);
    expect(Object.keys(db.collections)).toEqual(['pos_orders', 'register_sessions', 'cash_movements', 'closures']);
    expect(store.orders.name).toBe('pos_orders');
    expect(await store.orders.find().exec()).toEqual([]);
    expect(db.closed).toBe(false);
  } finally {
    await store.close();
  }
  expect(db.closed).toBe(true);
});
