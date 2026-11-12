import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
vi.mock('expo-router', () => ({ useRouter: () => ({ push: () => {} }) }));
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
const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');
afterEach(async () => {
  cleanup();
  await db.close();
  if (originalStorage) Object.defineProperty(navigator, 'storage', originalStorage);
  else Reflect.deleteProperty(navigator, 'storage');
});
function setStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { configurable: true, value });
}

// react-native-web drops className from the DOM, so read it off the component that took the testID (as logs-screen.test).
type Fiber = { memoizedProps?: { testID?: string; className?: unknown }; return?: Fiber; alternate?: Fiber };
function classesOf(testID: string): string[] {
  const node = screen.getByTestId(testID) as unknown as Record<string, unknown>;
  const key = (prefix: string) => Object.keys(node).find(name => name.startsWith(prefix))!;
  const created = node[key('__reactFiber$')] as Fiber;
  let fiber: Fiber | undefined = created.memoizedProps === node[key('__reactProps$')] ? created : created.alternate;
  const found: string[] = [];
  for (; fiber; fiber = fiber.return) {
    const { className, testID: id } = fiber.memoizedProps ?? {};
    if (id === testID && typeof className === 'string') found.push(...className.split(/\s+/));
  }
  return found;
}
const textOf = (testID: string) => screen.getByTestId(testID).textContent;

function insertOrder(id: string, extra: Partial<PosOrder>) {
  return orders.insert({ id, createdAt: '2026-10-07T09:00:00.000Z', updatedAt: '2026-10-07T09:00:00.000Z',
    currency: 'USD', pricesIncludeTax: false, lines: [], payments: [], customer: null,
    subtotalMinor: 100, discountMinor: 0, taxMinor: 0, totalMinor: 100,
    taxRounding: { granularity: 'per_line_items', mode: 'half_up' }, commandId: crypto.randomUUID(),
    syncStatus: 'pending', ...extra });
}

test('shows refused orders, then the counts, then the queued emails', async () => {
  mocks.outbox = { enabled: true, orders, state: { pending: 0, sending: false }, requeue: vi.fn(async () => 1) };
  await insertOrder('r1', { syncStatus: 'rejected' });
  await products.insert({ id: 'a' });
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  expect(screen.getByTestId('screen-health-database')).not.toBeNull();
  // The Store health area draws the title and the way back.
  expect(screen.queryByTestId('health-back')).toBeNull();
  expect(screen.queryByText('Store health')).toBeNull();
  expect(screen.queryByText('Your store, on this device — sales keep working even if your server does not.')).toBeNull();
  expect(screen.getByTestId('db-row-products')).not.toBeNull();
  expect(screen.getByTestId('db-row-orders')).not.toBeNull();
  await waitFor(() => expect(screen.getByTestId('db-row-count-orders').textContent).toBe('1'));
  const rejected = await screen.findByTestId('db-rejected');
  const table = screen.getByTestId('db-table');
  const emails = screen.getByTestId('queued-emails-stub');
  expect(emails.getAttribute('data-orders')).toBe('yes');
  expect(rejected.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(table.compareDocumentPosition(emails) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('Send again goes through the outbox', async () => {
  mocks.outbox = { enabled: true, orders, state: { pending: 0, sending: false }, requeue: vi.fn(async () => 1) };
  await insertOrder('r1', { syncStatus: 'rejected' });
  await products.insert({ id: 'a' });
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  fireEvent.click(await screen.findByTestId('db-rejected-requeue-r1'));
  expect(mocks.outbox.requeue).toHaveBeenCalledWith(['r1']);
});

test('a stuck sale puts the attention banner just after the stat strip, before the refused panel and the counts (v2 order)', async () => {
  mocks.outbox = { enabled: true, orders, requeue: vi.fn(async () => 0), flush: vi.fn(async () => {}), state: { pending: 1, sending: false,
    stuck: { commandIds: ['c1'], since: 1000, reason: 'Server error 500', orders: [{ commandId: 'c1', since: 1000, reason: 'Server error 500' }] } } };
  await insertOrder('r1', { syncStatus: 'rejected' });
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  const banner = screen.getByTestId('db-attention-panel');
  const rejected = await screen.findByTestId('db-rejected');
  expect(screen.getByTestId('db-stats').compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(banner.compareDocumentPosition(rejected) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(banner.compareDocumentPosition(screen.getByTestId('db-table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('without an open outbox there is no Orders row and no refused panel', () => {
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  expect(screen.getByTestId('db-row-products')).not.toBeNull();
  expect(screen.queryByTestId('db-row-orders')).toBeNull();
  expect(screen.queryByTestId('db-rejected')).toBeNull();
  expect(screen.getByTestId('queued-emails-stub').getAttribute('data-orders')).toBe('no');
});

test('the summary strip comes first: ready to sell, and the records sum the row counts', async () => {
  mocks.outbox = { enabled: true, orders, state: { pending: 0, sending: false }, requeue: vi.fn(async () => 0) };
  await products.bulkInsert([{ id: 'a' }, { id: 'b' }]);
  await insertOrder('o1', {});
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  const strip = screen.getByTestId('db-stats');
  expect(strip.compareDocumentPosition(screen.getByTestId('db-table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await waitFor(() => expect(textOf('db-row-count-products')).toBe('2'));
  await waitFor(() => expect(textOf('db-row-count-orders')).toBe('1'));
  await waitFor(() => expect(textOf('db-stat-ready-value')).toBe('✓ Ready to sell'));
  expect(classesOf('db-stat-ready-value')).toContain('text-success');
  expect(screen.getByText('catalog & open orders local')).not.toBeNull();
  const sum = Number(textOf('db-row-count-products')) + Number(textOf('db-row-count-orders'));
  await waitFor(() => expect(textOf('db-stat-records-value')).toBe(String(sum)));
  expect(screen.getByText('records on this device')).not.toBeNull();
});

test('with no products local it reads Preparing…', async () => {
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  await waitFor(() => expect(textOf('db-row-count-products')).toBe('0'));
  expect(textOf('db-stat-ready-value')).toBe('Preparing…');
  expect(classesOf('db-stat-ready-value')).not.toContain('text-success');
  expect(textOf('db-stat-records-value')).toBe('0');
});

test('the records value follows writes live', async () => {
  await products.insert({ id: 'a' });
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  await waitFor(() => expect(textOf('db-stat-records-value')).toBe('1'));
  await act(async () => { await products.insert({ id: 'b' }); });
  await waitFor(() => expect(textOf('db-stat-records-value')).toBe('2'));
  await act(async () => { await products.insert({ id: 'c' }); });
  await waitFor(() => expect(textOf('db-stat-records-value')).toBe('3'));
});

test('changes waiting to send: 0 reads good, pending orders read bad', () => {
  const { unmount } = render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  expect(textOf('db-stat-waiting-value')).toBe('0');
  expect(classesOf('db-stat-waiting-value')).toContain('text-success');
  expect(classesOf('db-stat-waiting-value')).not.toContain('text-destructive');
  expect(screen.getByText('changes waiting to send')).not.toBeNull();
  unmount();
  mocks.outbox = { enabled: true, orders, state: { pending: 3, sending: false }, requeue: vi.fn(async () => 0) };
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  expect(textOf('db-stat-waiting-value')).toBe('3');
  expect(classesOf('db-stat-waiting-value')).toContain('text-destructive');
});

test('the storage stat is hidden without navigator.storage', async () => {
  setStorage(undefined);
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  await waitFor(() => expect(textOf('db-row-count-products')).toBe('0'));
  expect(screen.queryByTestId('db-stat-storage')).toBeNull();
});

test('the storage stat reads the estimate', async () => {
  setStorage({ estimate: () => Promise.resolve({ usage: 2048 }) });
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  await waitFor(() => expect(textOf('db-stat-storage-value')).toBe('2.0 KB'));
  expect(screen.getByText('storage used')).not.toBeNull();
});
