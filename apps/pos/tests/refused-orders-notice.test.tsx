import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type PosOrder } from '@tallyui/pos';
import { RefusedOrdersNotice } from '../components/refused-orders-notice';

let db: RxDatabase;
let orders: RxCollection<PosOrder>;
beforeEach(async () => {
  db = await createRxDatabase({ name: `refused_orders_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  orders = await addPosOrderCollection(db);
});
afterEach(async () => { cleanup(); await db.close(); });

function insertOrder(id: string, extra: Partial<PosOrder>) {
  return orders.insert({ id, createdAt: '2026-10-07T09:00:00.000Z', updatedAt: '2026-10-07T09:00:00.000Z',
    currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
    subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
    taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
    syncStatus: 'pending', ...extra });
}

test('names the refused sales with their reason and leaves out pending, applied and reopened ones', async () => {
  await insertOrder('r1', { syncStatus: 'rejected', error: { code: 'invalid_payload', message: 'Line 2 has no product' } });
  await insertOrder('r2', { syncStatus: 'rejected', createdAt: '2026-10-07T09:30:00.000Z' });
  await insertOrder('p1', { syncStatus: 'pending' });
  await insertOrder('a1', { syncStatus: 'applied', serverRefs: { orderId: '1235', totalMinor: 100 } });
  await insertOrder('ro', { syncStatus: 'rejected', reopenedAt: '2026-10-07T09:40:00.000Z' });
  render(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} />);
  expect((await screen.findByTestId('orders-attention-title')).textContent).toBe('2 sales need attention');
  expect(screen.getAllByTestId(/^orders-attention-row-/).map(row => row.getAttribute('data-testid')))
    .toEqual(['orders-attention-row-r2', 'orders-attention-row-r1']);
  expect(screen.getByTestId('orders-attention-row-r1').textContent).toContain('invalid_payload · Line 2 has no product');
  expect(screen.getByTestId('orders-attention-row-r2').textContent).toContain('Your server refused it without saying why.');
  for (const id of ['p1', 'a1', 'ro']) expect(screen.queryByTestId(`orders-attention-row-${id}`)).toBeNull();
});

test('one refusal reads in the singular', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  render(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} />);
  expect((await screen.findByTestId('orders-attention-title')).textContent).toBe('1 sale needs attention');
});

test('shows the newest three, then a count', async () => {
  for (let i = 1; i <= 5; i++) await insertOrder(`r${i}`, { syncStatus: 'rejected', createdAt: `2026-10-07T09:0${i}:00.000Z` });
  render(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} />);
  expect((await screen.findAllByTestId(/^orders-attention-row-/)).map(row => row.getAttribute('data-testid')))
    .toEqual(['orders-attention-row-r5', 'orders-attention-row-r4', 'orders-attention-row-r3']);
  expect(screen.getByTestId('orders-attention-more').textContent).toBe('and 2 more');
});

test('no "more" line at three or fewer', async () => {
  for (let i = 1; i <= 3; i++) await insertOrder(`r${i}`, { syncStatus: 'rejected' });
  render(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} />);
  expect((await screen.findByTestId('orders-attention-title')).textContent).toBe('3 sales need attention');
  expect(screen.queryByTestId('orders-attention-more')).toBeNull();
});

test('Open order hands that order to the screen', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  const onOpen = vi.fn();
  render(<RefusedOrdersNotice orders={orders} onOpen={onOpen} />);
  fireEvent.click(await screen.findByTestId('orders-attention-open-r1'));
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'r1' }));
});

test('Review goes to Store health, and is absent without a handler', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  const onReview = vi.fn();
  const { rerender } = render(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} onReview={onReview} />);
  fireEvent.click(await screen.findByTestId('orders-attention-review'));
  expect(onReview).toHaveBeenCalledTimes(1);
  rerender(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} />);
  expect(screen.queryByTestId('orders-attention-review')).toBeNull();
});

test('renders nothing without an orders collection or a refusal', async () => {
  render(<RefusedOrdersNotice orders={null} onOpen={vi.fn()} />);
  expect(screen.queryByTestId('orders-attention')).toBeNull();
  cleanup();
  await insertOrder('p1', { syncStatus: 'pending' });
  render(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} />);
  await waitFor(() => expect(screen.queryByTestId('orders-attention')).toBeNull());
});

test('follows the collection: a refusal that is sent again leaves the band', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  render(<RefusedOrdersNotice orders={orders} onOpen={vi.fn()} />);
  expect(await screen.findByTestId('orders-attention')).not.toBeNull();
  await act(async () => { await (await orders.findOne('r1').exec())!.incrementalPatch({ syncStatus: 'pending' }); });
  await waitFor(() => expect(screen.queryByTestId('orders-attention')).toBeNull());
});
