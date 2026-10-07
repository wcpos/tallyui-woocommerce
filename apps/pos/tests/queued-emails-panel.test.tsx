import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type PosOrder } from '@tallyui/pos';
import { QueuedEmailsPanel, queuedAgo } from '../components/queued-emails-panel';
import { receiptEmailSchema, type ReceiptEmailCollection } from '../lib/receipts/receipt-emails';

let db: RxDatabase;
let collection: ReceiptEmailCollection;
let orders: RxCollection<PosOrder>;

beforeEach(async () => {
  db = await createRxDatabase({ name: `queued_emails_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  ({ receipt_emails: collection } = await db.addCollections<{ receipt_emails: ReceiptEmailCollection }>({
    receipt_emails: { schema: receiptEmailSchema },
  }));
  orders = await addPosOrderCollection(db);
});

afterEach(async () => {
  cleanup();
  await db.close();
});

test('lists waiting and failed emails oldest first with their order number', async () => {
  await collection.insert({ id: 'b', status: 'queued', email: 'b@example.invalid', queuedAt: '2026-10-07T09:55:00.000Z' });
  await collection.insert({ id: 'a', status: 'failed', email: 'a@example.invalid', queuedAt: '2026-10-07T07:00:00.000Z',
    error: 'The store refused the email: bad address' });
  await collection.insert({ id: 'c', status: 'sending', email: 'c@example.invalid', queuedAt: '2026-10-07T09:59:59.000Z' });
  await collection.insert({ id: 'd', status: 'sent', email: 'd@example.invalid', queuedAt: '2026-10-07T09:00:00.000Z' });
  for (const id of ['a', 'b', 'c']) {
    await orders.insert({ id, createdAt: '2026-10-07T07:00:00.000Z', updatedAt: '2026-10-07T07:00:00.000Z',
      currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
      subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
      taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
      syncStatus: id === 'a' ? 'applied' : 'pending',
      ...(id === 'a' ? { serverRefs: { orderId: '1234', totalMinor: 100 } } : {}) });
  }
  render(<QueuedEmailsPanel collection={collection} orders={orders} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  expect(await screen.findByText('3 receipt emails waiting to go out')).not.toBeNull();
  expect(screen.getByText('1 of these could not be sent and has stopped trying. Review the reason below, then remove it or send it again.')).not.toBeNull();
  expect(screen.getAllByTestId(/^db-queued-email-row-/).map(row => row.getAttribute('data-testid')))
    .toEqual(['db-queued-email-row-a', 'db-queued-email-row-b', 'db-queued-email-row-c']);
  expect(screen.queryByTestId('db-queued-email-row-d')).toBeNull();
  expect(await screen.findByText('a@example.invalid · #1234')).not.toBeNull();
  expect(screen.getByText('b@example.invalid · order b')).not.toBeNull();
  expect(screen.getByTestId('db-queued-email-failed-a').textContent).toBe('failed');
  expect(screen.getByTestId('db-queued-email-pending-b').textContent).toBe('waiting');
  expect(screen.getByTestId('db-queued-email-pending-c').textContent).toBe('waiting');
  expect(screen.getByText('queued 3 hours ago')).not.toBeNull();
  expect(screen.getByText('queued 5 minutes ago')).not.toBeNull();
  expect(screen.getByText('The store refused the email: bad address')).not.toBeNull();
  expect(screen.getByTestId('db-queued-email-retry-a')).not.toBeNull();
  expect(screen.queryByTestId('db-queued-email-retry-b')).toBeNull();
  expect(screen.queryByTestId('db-queued-email-retry-c')).toBeNull();
  await act(async () => {
    const order = await orders.findOne('b').exec();
    await order!.incrementalPatch({ serverRefs: { orderId: '1235', totalMinor: 100 } });
  });
  expect(await screen.findByText('b@example.invalid · #1235')).not.toBeNull();
});

test('shows the pending body when nothing has failed', async () => {
  await collection.insert({ id: 'a', status: 'queued', email: 'a@example.invalid', queuedAt: '2026-10-07T09:55:00.000Z' });
  render(<QueuedEmailsPanel collection={collection} orders={orders} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  expect(await screen.findByText('1 receipt email waiting to go out')).not.toBeNull();
  expect(screen.getByText('These are waiting for another send attempt. They may be retried automatically while this device can reach your store, but delivery is not guaranteed.')).not.toBeNull();
});

test('Send again requeues a failed email', async () => {
  await collection.insert({ id: 'a', status: 'failed', email: 'a@example.invalid', queuedAt: '2026-10-07T07:00:00.000Z', error: 'Bad address' });
  render(<QueuedEmailsPanel collection={collection} orders={orders} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  fireEvent.click(await screen.findByTestId('db-queued-email-retry-a'));
  await waitFor(async () => {
    const row = await collection.findOne('a').exec();
    expect(row?.status).toBe('queued');
    expect(row?.error).toBeUndefined();
  });
  expect(await screen.findByTestId('db-queued-email-pending-a')).not.toBeNull();
});

test('Send again does nothing once the email is no longer failed', async () => {
  const row = await collection.insert({ id: 'a', status: 'failed', email: 'a@example.invalid', queuedAt: '2026-10-07T07:00:00.000Z' });
  render(<QueuedEmailsPanel collection={collection} orders={orders} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  const retry = await screen.findByTestId('db-queued-email-retry-a');
  await row.incrementalPatch({ status: 'sending' });
  fireEvent.click(retry);
  await waitFor(() => expect(screen.getByTestId('db-queued-email-pending-a')).not.toBeNull());
  expect((await collection.findOne('a').exec())?.status).toBe('sending');
});

test('Remove deletes a waiting or failed email', async () => {
  await collection.insert({ id: 'a', status: 'failed', email: 'a@example.invalid', queuedAt: '2026-10-07T07:00:00.000Z' });
  await collection.insert({ id: 'b', status: 'queued', email: 'b@example.invalid', queuedAt: '2026-10-07T09:55:00.000Z' });
  render(<QueuedEmailsPanel collection={collection} orders={orders} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  fireEvent.click(await screen.findByTestId('db-queued-email-remove-b'));
  await waitFor(async () => expect(await collection.findOne('b').exec()).toBeNull());
  expect(screen.getByTestId('db-queued-email-row-a')).not.toBeNull();
  expect(await screen.findByText('Removed from the queue.')).not.toBeNull();
});

test('Remove refuses an email that is already sending', async () => {
  await collection.insert({ id: 'c', status: 'sending', email: 'c@example.invalid', queuedAt: '2026-10-07T09:59:59.000Z' });
  await collection.insert({ id: 'a', status: 'failed', email: 'a@example.invalid', queuedAt: '2026-10-07T07:00:00.000Z' });
  render(<QueuedEmailsPanel collection={collection} orders={orders} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  fireEvent.click(await screen.findByTestId('db-queued-email-remove-c'));
  expect(await screen.findByText('Delivery has already started and can’t be cancelled. The customer may still receive this email.')).not.toBeNull();
  expect((await collection.findOne('c').exec())?.status).toBe('sending');
});

test('renders nothing when the queue is empty or only sent', async () => {
  await collection.insert({ id: 'd', status: 'sent', email: 'd@example.invalid', queuedAt: '2026-10-07T09:00:00.000Z' });
  render(<QueuedEmailsPanel collection={collection} orders={orders} now={() => new Date('2026-10-07T10:00:00.000Z')} />);
  await waitFor(() => expect(screen.queryByTestId('db-queued-emails-callout')).toBeNull());
  await act(async () => {
    await collection.insert({ id: 'a', status: 'queued', email: 'a@example.invalid', queuedAt: '2026-10-07T09:55:00.000Z' });
  });
  expect(await screen.findByTestId('db-queued-emails-callout')).not.toBeNull();
});

test('queuedAgo uses whole relative units', () => {
  const now = new Date('2026-10-07T10:00:00.000Z');
  expect(queuedAgo('2026-10-07T09:55:00.000Z', now)).toBe('5 minutes ago');
  expect(queuedAgo('2026-10-07T10:00:00.000Z', now)).toBe('now');
  expect(queuedAgo('2026-10-07T07:00:00.000Z', now)).toBe('3 hours ago');
  expect(queuedAgo('2026-10-05T10:00:00.000Z', now)).toBe('2 days ago');
  expect(queuedAgo('2026-10-07T09:58:30.000Z', now)).toBe('1 minute ago');
});
