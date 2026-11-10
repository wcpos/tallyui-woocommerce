import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type PosOrder } from '@tallyui/pos';
import { HealthScreen } from '../components/health-screen';
import type { DatabaseCountRow } from '../components/database-counts';
import type { ReceiptEmailCollection } from '../lib/receipts/receipt-emails';

const mocks = vi.hoisted(() => ({ outbox: { enabled: false } as any }));
vi.mock('../lib/sale/outbox-context', () => ({ useOutbox: () => mocks.outbox }));
vi.mock('../components/queued-emails-panel', async () => {
  const { createElement } = await import('react');
  const actual = await vi.importActual<any>('../components/queued-emails-panel');
  return { ...actual, QueuedEmailsPanel: (props: { orders: unknown }) =>
    createElement('div', { 'data-testid': 'queued-emails-stub', 'data-orders': props.orders ? 'yes' : 'no' }) };
});

let db: RxDatabase;
let orders: RxCollection<PosOrder>;
let products: RxCollection;
let collections: DatabaseCountRow[];
const receiptEmails = {} as ReceiptEmailCollection;
beforeEach(async () => {
  mocks.outbox = { enabled: false };
  db = await createRxDatabase({ name: `health_screen_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  const schema = { version: 0, primaryKey: 'id', type: 'object', properties: { id: { type: 'string', maxLength: 100 } }, required: ['id'] };
  ({ products } = await db.addCollections({ products: { schema } }));
  orders = await addPosOrderCollection(db);
  collections = [{ key: 'products', label: 'Products', collection: products }];
});
afterEach(async () => { cleanup(); await db.close(); });

function insertOrder(id: string, extra: Partial<PosOrder>) {
  return orders.insert({ id, createdAt: '2026-10-07T09:00:00.000Z', updatedAt: '2026-10-07T09:00:00.000Z',
    currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
    subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
    taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
    syncStatus: 'pending', ...extra });
}

test('shows refused orders, then the counts, then the queued emails', async () => {
  mocks.outbox = { enabled: true, orders, requeue: vi.fn(async () => 1) };
  await insertOrder('r1', { syncStatus: 'rejected' });
  await products.insert({ id: 'a' });
  const onBack = vi.fn();
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} onBack={onBack} />);
  expect(screen.getByTestId('screen-health-database')).not.toBeNull();
  expect(screen.getByText('Your store, on this device — sales keep working even if your server does not.')).not.toBeNull();
  expect(screen.getByTestId('db-row-products')).not.toBeNull();
  expect(screen.getByTestId('db-row-orders')).not.toBeNull();
  await waitFor(() => expect(screen.getByTestId('db-row-count-orders').textContent).toBe('1'));
  const rejected = await screen.findByTestId('db-rejected');
  const table = screen.getByTestId('db-table');
  const emails = screen.getByTestId('queued-emails-stub');
  expect(emails.getAttribute('data-orders')).toBe('yes');
  expect(rejected.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(table.compareDocumentPosition(emails) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByTestId('health-back'));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('Send again goes through the outbox', async () => {
  mocks.outbox = { enabled: true, orders, requeue: vi.fn(async () => 1) };
  await insertOrder('r1', { syncStatus: 'rejected' });
  await products.insert({ id: 'a' });
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} onBack={vi.fn()} />);
  fireEvent.click(await screen.findByTestId('db-rejected-requeue-r1'));
  expect(mocks.outbox.requeue).toHaveBeenCalledWith(['r1']);
});

test('without an open outbox there is no Orders row and no refused panel', () => {
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} onBack={vi.fn()} />);
  expect(screen.getByTestId('db-row-products')).not.toBeNull();
  expect(screen.queryByTestId('db-row-orders')).toBeNull();
  expect(screen.queryByTestId('db-rejected')).toBeNull();
  expect(screen.getByTestId('queued-emails-stub').getAttribute('data-orders')).toBe('no');
});
