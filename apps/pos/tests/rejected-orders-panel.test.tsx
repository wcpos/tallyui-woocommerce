import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type PosOrder } from '@tallyui/pos';
import { RejectedOrdersPanel } from '../components/rejected-orders-panel';

let db: RxDatabase;
let orders: RxCollection<PosOrder>;
beforeEach(async () => {
  db = await createRxDatabase({ name: `rejected_orders_${crypto.randomUUID()}`, multiInstance: false,
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

test('lists refused orders newest first with their reason', async () => {
  await insertOrder('r1', { syncStatus: 'rejected', updatedAt: '2026-10-07T09:55:00.000Z',
    error: { code: 'invalid_payload', message: 'Line 2 has no product' } });
  await insertOrder('r2', { syncStatus: 'rejected', createdAt: '2026-10-07T09:30:00.000Z', serverRefs: { orderId: '1234', totalMinor: 100 } });
  await insertOrder('p1', { syncStatus: 'pending' });
  await insertOrder('a1', { syncStatus: 'applied', serverRefs: { orderId: '1235', totalMinor: 100 } });
  await insertOrder('ro', { syncStatus: 'rejected', reopenedAt: '2026-10-07T09:40:00.000Z' });
  render(<RejectedOrdersPanel orders={orders} onRequeue={vi.fn(async () => 1)} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  expect(await screen.findByText('2 changes never reached your server')).not.toBeNull();
  expect(screen.getByText('Your server refused these and nothing will retry them on its own. Send again rebuilds each one from what is on this device; discard drops the local change and keeps your server’s version.')).not.toBeNull();
  expect(screen.getAllByTestId(/^db-rejected-row-/).map(row => row.getAttribute('data-testid')))
    .toEqual(['db-rejected-row-r2', 'db-rejected-row-r1']);
  for (const id of ['p1', 'a1', 'ro']) expect(screen.queryByTestId(`db-rejected-row-${id}`)).toBeNull();
  for (const text of ['Orders · #1234', 'Orders · r1', 'invalid_payload · Line 2 has no product',
    'Your server refused it without saying why.', 'refused 5 minutes ago']) expect(screen.getByText(text)).not.toBeNull();
});

test('names one refused change in the singular', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  render(<RejectedOrdersPanel orders={orders} onRequeue={vi.fn(async () => 1)} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  expect(await screen.findByText('1 change never reached your server')).not.toBeNull();
});

test('Send again requeues that order through the callback', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  const onRequeue = vi.fn(async () => 1);
  render(<RejectedOrdersPanel orders={orders} onRequeue={onRequeue} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  fireEvent.click(await screen.findByTestId('db-rejected-requeue-r1'));
  expect(onRequeue).toHaveBeenCalledExactlyOnceWith(['r1']);
  await waitFor(() => expect(screen.getByTestId('db-rejected-message').textContent).toBe('Queued to send again.'));
});

test('Send again says so when nothing was requeued', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  const onRequeue = vi.fn(async () => 0);
  render(<RejectedOrdersPanel orders={orders} onRequeue={onRequeue} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  fireEvent.click(await screen.findByTestId('db-rejected-requeue-r1'));
  expect(await screen.findByText('Couldn’t queue that again.')).not.toBeNull();
  onRequeue.mockRejectedValueOnce(new Error('closed'));
  await act(async () => { fireEvent.click(screen.getByTestId('db-rejected-requeue-r1')); });
  expect(screen.getByText('Couldn’t queue that again.')).not.toBeNull();
  expect(onRequeue).toHaveBeenCalledTimes(2);
});

test('a second press while one requeue runs does nothing', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  let resolve!: (count: number) => void;
  const pending = new Promise<number>(done => { resolve = done; });
  const onRequeue = vi.fn(() => pending);
  render(<RejectedOrdersPanel orders={orders} onRequeue={onRequeue} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  const button = await screen.findByTestId('db-rejected-requeue-r1');
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(onRequeue).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(1); await pending; });
  expect(await screen.findByText('Queued to send again.')).not.toBeNull();
});

test('offers no Send again for a refusal kept for reconciliation', async () => {
  await insertOrder('x', { syncStatus: 'rejected', error: { code: 'idempotency_mismatch', message: 'Already created' } });
  render(<RejectedOrdersPanel orders={orders} onRequeue={vi.fn(async () => 1)} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  expect(await screen.findByTestId('db-rejected-row-x')).not.toBeNull();
  expect(screen.queryByTestId('db-rejected-requeue-x')).toBeNull();
});

test('follows the orders: a requeued order leaves and a new refusal appears', async () => {
  await insertOrder('r1', { syncStatus: 'rejected' });
  render(<RejectedOrdersPanel orders={orders} onRequeue={vi.fn(async () => 1)} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  expect(await screen.findByTestId('db-rejected-row-r1')).not.toBeNull();
  await act(async () => { await (await orders.findOne('r1').exec())!.incrementalPatch({ syncStatus: 'pending' }); });
  await waitFor(() => expect(screen.queryByTestId('db-rejected')).toBeNull());
  await act(async () => { await insertOrder('r3', { syncStatus: 'rejected' }); });
  expect(await screen.findByTestId('db-rejected-row-r3')).not.toBeNull();
});

test('renders nothing without an orders collection or a refusal', async () => {
  render(<RejectedOrdersPanel orders={null} onRequeue={vi.fn(async () => 1)} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  expect(screen.queryByTestId('db-rejected')).toBeNull();
  cleanup();
  await insertOrder('p1', { syncStatus: 'pending' });
  render(<RejectedOrdersPanel orders={orders} onRequeue={vi.fn(async () => 1)} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  await waitFor(() => expect(screen.queryByTestId('db-rejected')).toBeNull());
});
