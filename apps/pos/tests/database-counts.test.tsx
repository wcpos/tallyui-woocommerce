import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type PosOrder } from '@tallyui/pos';
import { DatabaseCounts, type DatabaseCountRow } from '../components/database-counts';
import { classesOf } from './classes-of';

let db: RxDatabase;
let orders: RxCollection<PosOrder>;
let products: RxCollection;
let coupons: RxCollection;
let rows: DatabaseCountRow[];
beforeEach(async () => {
  db = await createRxDatabase({ name: `database_counts_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  const schema = { version: 0, primaryKey: 'id', type: 'object', properties: { id: { type: 'string', maxLength: 100 } }, required: ['id'] };
  ({ products, coupons } = await db.addCollections({ products: { schema }, coupons: { schema } }));
  orders = await addPosOrderCollection(db);
  rows = [{ key: 'products', label: 'Products', collection: products }, { key: 'coupons', label: 'Coupons', collection: coupons }];
});
afterEach(async () => { cleanup(); await db.close(); });

function insertOrder(id: string, extra: Partial<PosOrder>) {
  return orders.insert({ id, createdAt: '2026-10-07T09:00:00.000Z', updatedAt: '2026-10-07T09:00:00.000Z',
    currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
    subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
    taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
    syncStatus: 'pending', ...extra });
}

test('counts each collection and follows writes', async () => {
  await products.bulkInsert([{ id: 'a' }, { id: 'b' }]);
  render(<DatabaseCounts rows={rows} />);
  expect(screen.getByTestId('db-table')).not.toBeNull();
  expect(screen.getByText('Collection')).not.toBeNull();
  expect(screen.getByText('On device')).not.toBeNull();
  await waitFor(() => expect(screen.getByTestId('db-row-count-products').textContent).toBe('2'));
  await waitFor(() => expect(screen.getByTestId('db-row-count-coupons').textContent).toBe('0'));
  await act(async () => { await coupons.insert({ id: 'c' }); });
  await waitFor(() => expect(screen.getByTestId('db-row-count-coupons').textContent).toBe('1'));
  await act(async () => { await (await products.findOne('a').exec())!.remove(); });
  await waitFor(() => expect(screen.getByTestId('db-row-count-products').textContent).toBe('1'));
});

test('Check for changes now runs only that row\'s sync, once at a time', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  const onSyncNow = vi.fn(() => pending);
  rows[0].onSyncNow = onSyncNow;
  render(<DatabaseCounts rows={rows} />);
  expect(screen.queryByTestId('db-row-sync-now-coupons')).toBeNull();
  const button = screen.getByTestId('db-row-sync-now-products');
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(onSyncNow).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); await pending; });
  await act(async () => { fireEvent.click(button); });
  expect(onSyncNow).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId('db-sync-failed-products')).toBeNull();
});

test('a failed sync says so until the next try', async () => {
  const onSyncNow = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  rows[0].onSyncNow = onSyncNow;
  render(<DatabaseCounts rows={rows} />);
  fireEvent.click(screen.getByTestId('db-row-sync-now-products'));
  await waitFor(() => expect(screen.getByTestId('db-sync-failed-products').textContent).toBe('Couldn’t sync with the server.'));
  fireEvent.click(screen.getByTestId('db-row-sync-now-products'));
  await waitFor(() => expect(screen.queryByTestId('db-sync-failed-products')).toBeNull());
});

test('v2\'s flat table: caption-rank heads, ruled rows at 61 px, no inner box', async () => {
  render(<DatabaseCounts rows={rows} />);
  for (const head of ['db-head-collection', 'db-head-local']) {
    expect(classesOf(head)).toEqual(expect.arrayContaining(['uppercase', 'text-muted-foreground', 'text-xs', 'tracking-wide']));
  }
  expect(classesOf('db-table-head')).toContain('border-b');
  expect(classesOf('db-row-products')).toEqual(expect.arrayContaining(['border-b', 'border-border', 'min-h-[61px]']));
  expect(classesOf('db-table')).not.toContain('border');
  expect(classesOf('db-table')).not.toContain('rounded-lg');
  expect(screen.queryByText('On server')).toBeNull();
  await waitFor(() => expect(screen.getByTestId('db-row-count-products').textContent).toBe('0'));
});
