import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type PosOrder } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
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

const renderCounts = () => render(<><DatabaseCounts rows={rows} /><PortalHost /></>);
/** Open a row's ⋮ menu and press Check for changes now (v2 health/database.tsx:347-360). */
function syncNow(key: string) {
  fireEvent.click(screen.getByTestId(`db-row-menu-${key}`));
  fireEvent.click(screen.getByTestId(`db-row-sync-now-${key}`));
}

test('v2\'s row menu: a ⋮ labelled More actions holds Check for changes now, no inline button', () => {
  const onSyncNow = vi.fn(async () => {});
  rows[0].onSyncNow = onSyncNow;
  renderCounts();
  expect(screen.getByTestId('db-row-menu-products').getAttribute('aria-label')).toBe('More actions');
  // The menu is closed: no Check for changes now anywhere until it opens
  expect(screen.queryByText('Check for changes now')).toBeNull();
  expect(screen.queryByTestId('db-row-sync-now-products')).toBeNull();
  expect(screen.queryByTestId('db-row-menu-coupons')).toBeNull();
  fireEvent.click(screen.getByTestId('db-row-menu-products'));
  expect(screen.getByTestId('db-row-sync-now-products').textContent).toBe('Check for changes now');
  expect(screen.getByTestId('db-row-products').textContent).not.toContain('Check for changes now');
  fireEvent.click(screen.getByTestId('db-row-sync-now-products'));
  expect(onSyncNow).toHaveBeenCalledTimes(1);
});

test('Check for changes now runs only that row\'s sync, once at a time', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  const onSyncNow = vi.fn(() => pending);
  rows[0].onSyncNow = onSyncNow;
  renderCounts();
  expect(screen.queryByTestId('db-row-menu-coupons')).toBeNull();
  syncNow('products');
  // While it runs the ⋮ is disabled, so the item cannot be reached again
  fireEvent.click(screen.getByTestId('db-row-menu-products'));
  expect(screen.queryByTestId('db-row-sync-now-products')).toBeNull();
  expect(onSyncNow).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(); await pending; });
  syncNow('products');
  expect(onSyncNow).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId('db-sync-failed-products')).toBeNull();
});

test('a failed sync says so until the next try', async () => {
  const onSyncNow = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  rows[0].onSyncNow = onSyncNow;
  renderCounts();
  syncNow('products');
  await waitFor(() => expect(screen.getByTestId('db-sync-failed-products').textContent).toBe('Couldn’t sync with the server.'));
  // The ⋮ comes back once the failed sync settles
  await waitFor(() => expect(screen.getByTestId('db-row-menu-products').getAttribute('aria-disabled')).not.toBe('true'));
  syncNow('products');
  await waitFor(() => expect(screen.queryByTestId('db-sync-failed-products')).toBeNull());
  expect(onSyncNow).toHaveBeenCalledTimes(2);
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
  // v2's on-device column (database.tsx:267 `w-20 items-end`), the count in tabular figures (:413)
  expect(classesOf('db-head-local')).toEqual(expect.arrayContaining(['w-20', 'text-right']));
  expect(classesOf('db-row-count-products')).toEqual(expect.arrayContaining(['w-20', 'text-right', 'tabular-nums']));
  expect(screen.queryByText('On server')).toBeNull();
  await waitFor(() => expect(screen.getByTestId('db-row-count-products').textContent).toBe('0'));
});
