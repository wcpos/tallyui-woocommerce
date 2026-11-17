import { afterEach, expect, test, vi } from 'vitest';
import { removeRxDatabase, type RxStorage } from 'rxdb';
import { CASHIERS_KEY, SESSION_KEY, type Session } from '../lib/auth/session';
import { databaseName } from '../lib/catalogue/start-catalogue';
import { ordersDatabaseName } from '../lib/sale/order-store';
import {
  describeResetConfirm, isLocalDataResetScheduled, localDatabaseNames, LOCAL_DATA_RESET_KEY,
  runLocalDataReset, scheduleLocalDataReset,
} from '../lib/local-data-reset';

vi.mock('rxdb', async importOriginal => ({
  ...await importOriginal<typeof import('rxdb')>(), removeRxDatabase: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());

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
const a = { site: { home: 'https://shop.example/' }, tokens: { user: { id: 1 } } } as Session;
const b = { site: { home: 'https://other.example/' }, tokens: { user: { id: 2 } } } as Session;
const row = 'Products, customers and orders are downloaded again from your server.';
const none = 'Nothing is waiting to be sent, so your server already has your sales.';
const three = '3 changes on this device have never reached your server and will be permanently lost. They may include completed sales that exist only on this device.';
const unchecked = 'The app could not check Shop · Ann, Other for changes waiting to be sent, so this may include completed sales that never reached your server. They cannot be recovered.';
const stays = (n: string) => `Till sessions, cash counts and closures on this device are not stored on your server and will be deleted (${n}).`;

test('describeResetConfirm puts the warning first, then what stays local, then what the clear downloads again', () => {
  expect(describeResetConfirm({ unsent: 0, localOnly: 0, unchecked: [] })).toBe(`${none} ${row}`);
  expect(describeResetConfirm({ unsent: 1, localOnly: 0, unchecked: [] })).toBe(`1 change on this device has never reached your server and will be permanently lost. It may be a completed sale that exists only on this device. ${row}`);
  expect(describeResetConfirm({ unsent: 3, localOnly: 0, unchecked: [] })).toBe(`${three} ${row}`);
  expect(describeResetConfirm({ unsent: 0, localOnly: 0, unchecked: ['Shop · Ann', 'Other'] })).toBe(`${unchecked} ${row}`);
  expect(describeResetConfirm({ unsent: 3, localOnly: 1, unchecked: ['Shop · Ann', 'Other'] })).toBe(`${three} ${unchecked} ${stays('1 record')} ${row}`);
  expect(describeResetConfirm({ unsent: 0, localOnly: 4, unchecked: [] })).toBe(`${none} ${stays('4 records')} ${row}`);
});

test.each(['null', '"x"', '[1]'])('a cashier roster of %s cannot stop the reset or leave the flag set', async roster => {
  const local = memoryStorage();
  local.setItem(SESSION_KEY, JSON.stringify(a));
  local.setItem(CASHIERS_KEY, roster);
  local.setItem(LOCAL_DATA_RESET_KEY, '1');
  const remove = vi.fn<typeof removeRxDatabase>().mockResolvedValue([]);
  const sentinel = {} as RxStorage<any, any>;
  await expect(runLocalDataReset({ local, session: memoryStorage(), storage: () => sentinel, remove })).resolves.toBeUndefined();
  expect(local.getItem(LOCAL_DATA_RESET_KEY)).toBeNull();
  expect(remove.mock.calls).toEqual([[databaseName(a), sentinel, false], [ordersDatabaseName(a), sentinel, false]]);
});

test('the flag is removed even when no database can be removed', async () => {
  const local = memoryStorage();
  local.setItem(SESSION_KEY, JSON.stringify(a));
  local.setItem(CASHIERS_KEY, JSON.stringify({ [b.site.home]: [b] }));
  local.setItem(LOCAL_DATA_RESET_KEY, '1');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const flagAtRemove: (string | null)[] = [];
  const remove = vi.fn<typeof removeRxDatabase>(async () => {
    flagAtRemove.push(local.getItem(LOCAL_DATA_RESET_KEY));
    throw new Error('cannot remove');
  });
  await runLocalDataReset({ local, session: memoryStorage(), storage: () => ({}) as RxStorage<any, any>, remove });
  expect(remove).toHaveBeenCalledTimes(4);
  expect(flagAtRemove).toEqual([null, null, null, null]);
  expect(local.getItem(LOCAL_DATA_RESET_KEY)).toBeNull();
});

test('localDatabaseNames lists the catalogue and orders database of the active and every stored cashier, once each', () => {
  const local = memoryStorage();
  local.setItem(SESSION_KEY, JSON.stringify(a));
  local.setItem(CASHIERS_KEY, JSON.stringify({ [a.site.home]: [a], [b.site.home]: [b] }));
  expect(localDatabaseNames(local)).toEqual([databaseName(a), ordersDatabaseName(a), databaseName(b), ordersDatabaseName(b)]);
});

test('localDatabaseNames is empty with no session', () => {
  expect(localDatabaseNames(memoryStorage())).toEqual([]);
});

test('a stored session that cannot be named is skipped, and the clear still runs', async () => {
  const local = memoryStorage();
  local.setItem(SESSION_KEY, JSON.stringify(a));
  local.setItem(CASHIERS_KEY, JSON.stringify({ [b.site.home]: [{}, b] }));
  local.setItem(LOCAL_DATA_RESET_KEY, '1');
  expect(localDatabaseNames(local)).toEqual([databaseName(a), ordersDatabaseName(a), databaseName(b), ordersDatabaseName(b)]);
  const remove = vi.fn<typeof removeRxDatabase>().mockResolvedValue([]);
  const sentinel = {} as RxStorage<any, any>;
  await expect(runLocalDataReset({ local, session: memoryStorage(), storage: () => sentinel, remove })).resolves.toBeUndefined();
  expect(remove).toHaveBeenCalledTimes(4);
  expect(local.length).toBe(0);
});

test('runLocalDataReset removes each database before clearing the app keys', async () => {
  const local = memoryStorage();
  const session = memoryStorage();
  local.setItem(SESSION_KEY, JSON.stringify(a));
  local.setItem(CASHIERS_KEY, JSON.stringify({ [a.site.home]: [a], [b.site.home]: [b] }));
  local.setItem('tallywoo.device_id', 'device');
  local.setItem(LOCAL_DATA_RESET_KEY, '1');
  local.setItem('other.key', 'keep');
  session.setItem('tallywoo.auth.pending', 'pending');
  session.setItem('other.key', 'also keep');
  const names = localDatabaseNames(local);
  const sentinel = {} as RxStorage<any, any>;
  const hadSession: boolean[] = [];
  const remove = vi.fn<typeof removeRxDatabase>(async () => {
    hadSession.push(local.getItem(SESSION_KEY) !== null);
    return [];
  });
  await runLocalDataReset({ local, session, storage: () => sentinel, remove });
  expect(remove.mock.calls).toEqual(names.map(name => [name, sentinel, false]));
  expect(hadSession).toEqual(names.map(() => true));
  for (const key of [SESSION_KEY, CASHIERS_KEY, 'tallywoo.device_id', LOCAL_DATA_RESET_KEY]) {
    expect(local.getItem(key)).toBeNull();
  }
  expect(session.getItem('tallywoo.auth.pending')).toBeNull();
  expect(local.getItem('other.key')).toBe('keep');
  expect(session.getItem('other.key')).toBe('also keep');
});

test('runLocalDataReset carries on past a database that cannot be removed', async () => {
  const local = memoryStorage();
  local.setItem(SESSION_KEY, JSON.stringify(a));
  local.setItem(LOCAL_DATA_RESET_KEY, '1');
  const error = new Error('cannot remove');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const remove = vi.fn<typeof removeRxDatabase>().mockRejectedValueOnce(error).mockResolvedValue([]);
  const sentinel = {} as RxStorage<any, any>;
  await runLocalDataReset({ local, session: memoryStorage(), storage: () => sentinel, remove });
  expect(remove.mock.calls).toEqual([[databaseName(a), sentinel, false], [ordersDatabaseName(a), sentinel, false]]);
  expect(warn).toHaveBeenCalledExactlyOnceWith('Clear local data: could not remove', databaseName(a), error);
  expect(local.length).toBe(0);
});

test('scheduleLocalDataReset sets the flag the gate reads', () => {
  const local = memoryStorage();
  expect(isLocalDataResetScheduled(local)).toBe(false);
  expect(scheduleLocalDataReset(local)).toBe(true);
  expect(local.getItem(LOCAL_DATA_RESET_KEY)).toBe('1');
  expect(isLocalDataResetScheduled(local)).toBe(true);
  const inaccessible = { ...memoryStorage(), setItem() { throw new Error('denied'); } };
  expect(scheduleLocalDataReset(inaccessible)).toBe(false);
});
