import { expect, test, vi } from 'vitest';
import type { RxCollection } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { openSession, type PosOrder } from '@tallyui/pos';
import { CASHIERS_KEY, SESSION_KEY, type Session } from '../lib/auth/session';
import { checkLocalData, openOrdersForCheck, type OpenedOrders } from '../lib/local-data-check';
import { openOrderStore, ordersDatabaseName } from '../lib/sale/order-store';

const memory = getRxStorageMemory();

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
  };
}
// Memory databases outlive close() in this process, so every test gets its own store home.
function cashier(id: number, displayName: string, home = `https://${crypto.randomUUID()}.example/`): Session {
  return { site: { name: 'Corner Café', home, wpApiUrl: '', wcposApiUrl: '', authUrl: '' },
    tokens: { accessToken: 'secret-token', refreshToken: 'secret-refresh', expiresAt: 2000000000,
      user: { id, uuid: `cashier-${id}`, displayName } } };
}
function roster(active: Session, others: Session[]): Storage {
  const storage = memoryStorage();
  storage.setItem(SESSION_KEY, JSON.stringify(active));
  storage.setItem(CASHIERS_KEY, JSON.stringify({ [active.site.home]: others }));
  return storage;
}
function insertOrder(orders: RxCollection<PosOrder>, id: string, extra: Partial<PosOrder>) {
  return orders.insert({ id, createdAt: '2026-11-17T09:00:00.000Z', updatedAt: '2026-11-17T09:00:00.000Z',
    currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
    subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
    taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
    syncStatus: 'pending', ...extra });
}
async function seed(session: Session, fill: (store: Awaited<ReturnType<typeof openOrderStore>>) => Promise<unknown>) {
  const store = await openOrderStore(ordersDatabaseName(session), memory);
  try { await fill(store); } finally { await store.close(); }
}
function spyOpen() {
  const opened: OpenedOrders[] = [];
  const open = vi.fn(async (name: string) => {
    const handle = await openOrdersForCheck(name, memory);
    opened.push(handle);
    return handle;
  });
  return { open, opened };
}

test('unsent sales under an inactive cashier are counted, and the active database is not opened again', async () => {
  const a = cashier(1, 'Ann');
  const b = cashier(2, 'Ben', a.site.home);
  await seed(b, async ({ orders }) => {
    await insertOrder(orders, 'p1', { syncStatus: 'pending' });
    await insertOrder(orders, 'p2', { syncStatus: 'pending' });
    await insertOrder(orders, 'r1', { syncStatus: 'rejected' });
    await insertOrder(orders, 'done', { syncStatus: 'applied' });
  });
  const active = await openOrderStore(ordersDatabaseName(a), memory);
  try {
    await insertOrder(active.orders, 'mine', { syncStatus: 'applied' });
    const { open, opened } = spyOpen();
    expect(await checkLocalData({ active: active.orders.database, storage: roster(a, [a, b]), open }))
      .toEqual({ unsent: 3, localOnly: 0, unchecked: [] });
    expect(open.mock.calls).toEqual([[ordersDatabaseName(b)]]);
    expect(open).not.toHaveBeenCalledWith(ordersDatabaseName(a));
    expect(opened.map(handle => handle.db.closed)).toEqual([true]);
    expect(active.orders.database.closed).toBe(false);
  } finally {
    await active.close();
  }
});

test('with no active database, the active cashier is opened like the others', async () => {
  const a = cashier(1, 'Ann');
  await seed(a, ({ orders }) => insertOrder(orders, 'p1', { syncStatus: 'pending' }));
  const { open, opened } = spyOpen();
  expect(await checkLocalData({ active: null, storage: roster(a, []), open })).toEqual({ unsent: 1, localOnly: 0, unchecked: [] });
  expect(open.mock.calls).toEqual([[ordersDatabaseName(a)]]);
  expect(opened.every(handle => handle.db.closed)).toBe(true);
});

test('a fresh register document alone stays out of localOnly; opened sessions, cash movements and closures count', async () => {
  const a = cashier(1, 'Ann');
  const b = cashier(2, 'Ben', a.site.home);
  await seed(a, async () => {});
  expect(await checkLocalData({ active: null, storage: roster(a, []), open: spyOpen().open }))
    .toEqual({ unsent: 0, localOnly: 0, unchecked: [] });
  await seed(b, async store => {
    const db = store.orders.database;
    const session = await openSession(db.register_sessions, { registerId: 'register-1', expectedFloatMinor: null,
      countedFloatMinor: 0, openedBy: '2', businessDay: { year: 2026, month: 11, day: 17 } });
    await db.cash_movements.insert({ id: 'm1', session_id: session.id, type: 'paid_in', amountMinor: 500,
      reason: 'Float', created_at_gmt: '2026-11-17T09:00:00.000Z' });
    await db.closures.insert({ id: 'c1', session_id: session.id, register_id: 'register-1', number: 1 });
  });
  const { open, opened } = spyOpen();
  expect(await checkLocalData({ active: null, storage: roster(a, [b]), open })).toEqual({ unsent: 0, localOnly: 3, unchecked: [] });
  expect(opened.map(handle => handle.db.closed)).toEqual([true, true]);
});

test('a database that will not open is named by store and cashier, and the others are still counted', async () => {
  const a = cashier(1, 'Ann');
  const b = cashier(2, 'Ben', a.site.home);
  const c = cashier(3, '', a.site.home);
  await seed(a, ({ orders }) => insertOrder(orders, 'p1', { syncStatus: 'pending' }));
  await seed(c, ({ orders }) => insertOrder(orders, 'p2', { syncStatus: 'rejected' }));
  const { open: real, opened } = spyOpen();
  const open = vi.fn((name: string) => name === ordersDatabaseName(b) ? Promise.reject(new Error('locked')) : real(name));
  const check = await checkLocalData({ active: null, storage: roster(a, [b, c]), open });
  expect(check).toEqual({ unsent: 2, localOnly: 0, unchecked: ['Corner Café · Ben'] });
  expect(JSON.stringify(check)).not.toContain('secret');
  expect(open).toHaveBeenCalledTimes(3);
  expect(opened).toHaveLength(2);
  expect(opened.every(handle => handle.db.closed)).toBe(true);
});

test('a database whose count fails is closed and named', async () => {
  const a = cashier(1, 'Ann');
  await seed(a, async () => {});
  const { open: real, opened } = spyOpen();
  const open = vi.fn(async (name: string) => {
    const handle = await real(name);
    vi.spyOn(handle.db.collections.closures, 'find').mockImplementation(() => { throw new Error('broken'); });
    return handle;
  });
  expect(await checkLocalData({ active: null, storage: roster(a, []), open }))
    .toEqual({ unsent: 0, localOnly: 0, unchecked: ['Corner Café · Ann'] });
  expect(opened.map(handle => handle.db.closed)).toEqual([true]);
});
