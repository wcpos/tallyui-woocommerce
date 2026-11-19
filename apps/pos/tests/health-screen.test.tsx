import * as ReactNative from 'react-native';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase, type RxCollection, type RxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { addPosOrderCollection, type PosOrder } from '@tallyui/pos';
import { HealthScreen } from '../components/health-screen';
import type { DatabaseCountRow } from '../components/database-counts';
import type { ReceiptEmailCollection } from '../lib/receipts/receipt-emails';
import { BehaviorSubject } from 'rxjs';
import { OnlineStatusContext, type OnlineStatus } from '../lib/online/online-status';
import { dismissToast, getToasts } from '../lib/toast/toast';

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

// v2 database.tsx:708-715 and core.json health.database.offline / offline_preparing.
const OFFLINE_READY = "You're offline. Sales keep working — anything you make is stored here and delivered when your server is back.";
const OFFLINE_PREPARING = "You're offline and still setting up — this till can't sell until its catalog finishes downloading.";
function renderWith(status: OnlineStatus) {
  return render(<OnlineStatusContext.Provider value={{ status }}>
    <HealthScreen receiptEmails={receiptEmails} collections={collections} /></OnlineStatusContext.Provider>);
}

test('offline and ready to sell: the notice says sales keep working, after the stat strip and before the table', async () => {
  await products.insert({ id: 'a' });
  renderWith('offline');
  await waitFor(() => expect(textOf('db-row-count-products')).toBe('1'));
  await waitFor(() => expect(textOf('db-offline-notice-title')).toBe(OFFLINE_READY));
  const notice = screen.getByTestId('db-offline-notice');
  expect(screen.getByTestId('db-stats').compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(notice.compareDocumentPosition(screen.getByTestId('db-table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('offline and still preparing: the notice says the till cannot sell yet', async () => {
  renderWith('offline');
  await waitFor(() => expect(textOf('db-row-count-products')).toBe('0'));
  expect(textOf('db-offline-notice-title')).toBe(OFFLINE_PREPARING);
});

test('online: no offline notice', async () => {
  const { unmount } = render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  await waitFor(() => expect(textOf('db-row-count-products')).toBe('0'));
  expect(screen.queryByTestId('db-offline-notice')).toBeNull();
  unmount();
  // v2 shows it only for connectivity 'offline', not for a server it cannot reach.
  renderWith('online-website-unavailable');
  await waitFor(() => expect(textOf('db-row-count-products')).toBe('0'));
  expect(screen.queryByTestId('db-offline-notice')).toBeNull();
});

// v2 database.tsx:815-863, the Freshness station.
const toasts = () => getToasts().map(({ type, title, description }) => ({ type, title, description }));
function checkRows(products: () => Promise<void>, coupons: () => Promise<void>): DatabaseCountRow[] {
  return [{ ...collections[0], onSyncNow: products }, { key: 'coupons', label: 'Coupons', collection: collections[0].collection, onSyncNow: coupons },
    { key: 'parked', label: 'Parked sales', collection: collections[0].collection }];
}

test('the freshness line reads First check pending… with no due time and Watching for changes with one', () => {
  const subject = new BehaviorSubject<number | undefined>(undefined);
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} runner={{ nextDueAtMs$: subject }} />);
  expect(textOf('db-freshness-label')).toBe('First check pending…');
  act(() => subject.next(Date.now() + 42_000));
  expect(textOf('db-freshness-label')).toBe('Watching for changes · next check ~42 s');
  expect(textOf('db-check-everything')).toBe('Check everything now');
});

test('Check everything now runs every row\'s check once', async () => {
  act(() => dismissToast());
  const products = vi.fn(async () => {}), coupons = vi.fn(async () => {});
  render(<HealthScreen receiptEmails={receiptEmails} collections={checkRows(products, coupons)} />);
  fireEvent.click(screen.getByTestId('db-check-everything'));
  await waitFor(() => expect(screen.getByTestId('db-check-everything').getAttribute('aria-disabled')).not.toBe('true'));
  expect(products).toHaveBeenCalledTimes(1);
  expect(coupons).toHaveBeenCalledTimes(1);
  expect(toasts()).toEqual([]);
});

test('offline, Check everything now runs none and toasts Sync didn’t run', () => {
  act(() => dismissToast());
  const products = vi.fn(async () => {}), coupons = vi.fn(async () => {});
  render(<OnlineStatusContext.Provider value={{ status: 'offline' }}>
    <HealthScreen receiptEmails={receiptEmails} collections={checkRows(products, coupons)} /></OnlineStatusContext.Provider>);
  fireEvent.click(screen.getByTestId('db-check-everything'));
  expect(products).not.toHaveBeenCalled();
  expect(coupons).not.toHaveBeenCalled();
  expect(toasts()).toEqual([{ type: 'warning', title: 'Sync didn’t run.', description: 'This device is offline.' }]);
  act(() => dismissToast());
});

test('a failing row makes Check everything now toast Couldn’t sync with the server once', async () => {
  act(() => dismissToast());
  const products = vi.fn(async () => { throw new Error('down'); }), coupons = vi.fn(async () => {});
  render(<HealthScreen receiptEmails={receiptEmails} collections={checkRows(products, coupons)} />);
  fireEvent.click(screen.getByTestId('db-check-everything'));
  await waitFor(() => expect(toasts()).toEqual([{ type: 'error', title: 'Couldn’t sync with the server.',
    description: 'Check your connection and try again. Logs has the details.' }]));
  expect(coupons).toHaveBeenCalledTimes(1);
  act(() => dismissToast());
});

test('a second press while it runs does nothing', async () => {
  let resolve!: () => void;
  const pending = new Promise<void>(done => { resolve = done; });
  const products = vi.fn(() => pending), coupons = vi.fn(async () => {});
  render(<HealthScreen receiptEmails={receiptEmails} collections={checkRows(products, coupons)} />);
  const button = screen.getByTestId('db-check-everything');
  // Both presses land before React re-renders the button disabled, as a fast double tap can.
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(screen.getByTestId('db-check-everything').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('db-check-everything'));
  await act(async () => { resolve(); await pending; });
  expect(products).toHaveBeenCalledTimes(1);
  expect(coupons).toHaveBeenCalledTimes(1);
});

// v2 database.tsx:557-572 (HowSyncingWorksLink) and core.json:1974 "How syncing works".
test('How syncing works links out to v2\'s sync docs', () => {
  const open = vi.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(true);
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections} />);
  const link = screen.getByTestId('db-how-syncing-works');
  expect(link.textContent).toBe('How syncing works');
  fireEvent.click(link);
  expect(open).toHaveBeenCalledExactlyOnceWith('https://docs.wcpos.com/products/sync');
  open.mockRestore();
});

// v2 database.tsx:826-850: the link closes the status column (VStack gap-0.5), and Check everything now follows it.
test('How syncing works sits under the freshness line, beside Check everything now', () => {
  render(<HealthScreen receiptEmails={receiptEmails} collections={collections}
    runner={{ nextDueAtMs$: new BehaviorSubject<number | undefined>(undefined) }} />);
  const lines = screen.getByTestId('db-freshness-lines');
  const label = screen.getByTestId('db-freshness-label'), link = screen.getByTestId('db-how-syncing-works');
  expect(lines.contains(label) && lines.contains(link)).toBe(true);
  expect(label.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const check = screen.getByTestId('db-check-everything');
  expect(lines.contains(check)).toBe(false);
  expect(lines.nextElementSibling).toBe(check);
  expect(classesOf('db-how-syncing-works')).toContain('ml-3');
});
