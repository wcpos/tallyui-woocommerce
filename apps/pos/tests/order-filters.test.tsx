import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { StoreOrder } from '@tallyui/core';
import type { PosOrder } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { OrdersScreen } from '../components/orders-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import type { OrderHistorySource } from '../lib/orders/order-history';

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: 'Store', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

let localOrders: { insert(order: PosOrder): Promise<unknown> } | undefined;
function OrderStoreReady() {
  const outbox = useOutbox();
  if (outbox.enabled) localOrders = outbox.orders ?? undefined;
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}
const order: StoreOrder = {
  id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z',
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 1, subtotalMinor: 300, subtotalTaxMinor: 0, totalMinor: 300, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [], payments: [],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 300,
};
const scope = { cashierId: '2', createdVia: 'woocommerce-pos' };
async function setup(fields: OrderHistorySource['fields'] = ['status', 'customerId', 'cashierId', 'storeId', 'createdVia', 'dateRange'], row: StoreOrder = order) {
  const list = vi.fn<OrderHistorySource['list']>().mockResolvedValue({ orders: [row], hasMore: false });
  const onCustomerSearch = vi.fn().mockResolvedValue([{ id: '7', name: 'Ada Lovelace' }]);
  render(<SessionProvider><OutboxProvider storage={getRxStorageMemory()} transportFor={() => ({ send: async () => ({ kind: 'results', results: [] }) })}>
    <OrderStoreReady />
    <OrdersScreen onBack={() => {}} history={{ fields, list }} storeName="Store" cashierId="2" cashierName="Paul" onCustomerSearch={onCustomerSearch} />
    <PortalHost />
  </OutboxProvider></SessionProvider>);
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
  await screen.findByTestId('history-row-901');
  return { list, onCustomerSearch };
}

test('resting scope shows only supported pills and does not count as a filter', async () => {
  const { list } = await setup();
  expect(list.mock.calls[0]).toEqual([1, undefined, scope]);
  for (const id of ['orders-chip-row', 'order-filter-status', 'order-filter-customer', 'order-filter-cashier', 'order-filter-store']) {
    expect(screen.getByTestId(id)).not.toBeNull();
  }
  for (const id of ['order-filter-payment-method', 'order-filter-register', 'orders-filter-clear-all']) expect(screen.queryByTestId(id)).toBeNull();
});

test('status reloads page one with the resting scope', async () => {
  const { list } = await setup();
  fireEvent.click(screen.getByTestId('order-filter-status'));
  fireEvent.click(await screen.findByTestId('order-filter-status-processing'));
  await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(1, undefined, { ...scope, status: 'processing' }));
});

test("the Status filter lists v2's POS open and POS partial", async () => {
  await setup();
  fireEvent.click(screen.getByTestId('order-filter-status'));
  expect((await screen.findByTestId('order-filter-status-pos-open')).textContent).toContain('POS open');
  expect(screen.getByTestId('order-filter-status-pos-partial').textContent).toContain('POS partial');
});

test('customer search passes text and filters by the chosen customer', async () => {
  const { list, onCustomerSearch } = await setup();
  fireEvent.click(screen.getByTestId('order-filter-customer'));
  fireEvent.change(await screen.findByTestId('order-filter-customer-search'), { target: { value: 'ada' } });
  await vi.waitFor(() => expect(onCustomerSearch).toHaveBeenCalledWith('ada'));
  fireEvent.click(await screen.findByTestId('order-filter-customer-7'));
  await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(1, undefined, { ...scope, customerId: '7' }));
});

test('Clear all returns status and customer to the resting scope', async () => {
  const { list } = await setup();
  fireEvent.click(screen.getByTestId('order-filter-status'));
  fireEvent.click(await screen.findByTestId('order-filter-status-processing'));
  fireEvent.click(screen.getByTestId('order-filter-customer'));
  fireEvent.change(await screen.findByTestId('order-filter-customer-search'), { target: { value: 'ada' } });
  fireEvent.click(await screen.findByTestId('order-filter-customer-7'));
  await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(1, undefined, { ...scope, status: 'processing', customerId: '7' }));
  fireEvent.click(screen.getByTestId('orders-filter-clear-all'));
  await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(1, undefined, scope));
  expect(screen.queryByTestId('orders-filter-clear-all')).toBeNull();
});

test('no fields means no bar and the original list call', async () => {
  const { list } = await setup([]);
  expect(screen.queryByTestId('orders-chip-row')).toBeNull();
  expect(list.mock.calls).toEqual([[1]]);
});

// v2's cell taps (status-filter-cell.tsx:24-32, order/customer.tsx:32-39): the wide table's status and customer filter the list.
test("a row's status filters the list to it and does not open the order", async () => {
  const { list } = await setup(undefined, { ...order, status: 'processing' });
  const cell = screen.getByTestId('history-901-status-filter');
  expect(cell.getAttribute('aria-label')).toBe('Processing');
  // The press focuses the row, and the table's Enter opens a focused row, so the cell must keep its key to itself.
  fireEvent.focus(cell);
  fireEvent.keyDown(cell, { key: 'Enter' });
  fireEvent.click(cell);
  await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(1, undefined, { ...scope, status: 'processing' }));
  expect(screen.getByTestId('order-filter-status').textContent).toContain('Processing');
  expect(screen.queryByTestId('order-modal')).toBeNull();
  // The chevron opens the order sheet, so the check above looks for what an open would show.
  fireEvent.click(await screen.findByTestId('history-open-901'));
  expect(await screen.findByTestId('order-modal')).not.toBeNull();
});

test("a row's customer chip filters to that customer and names them in the Customer chip", async () => {
  const { list } = await setup(undefined, { ...order, customer: { id: '7', name: 'Ada Lovelace' } });
  fireEvent.click(screen.getByTestId('history-901-customer-chip'));
  await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(1, undefined, { ...scope, customerId: '7' }));
  expect(screen.getByTestId('order-filter-customer').textContent).toContain('Ada Lovelace');
  expect(screen.queryByTestId('order-modal')).toBeNull();
});

test("a guest's customer chip filters to Guest", async () => {
  const { list } = await setup();
  fireEvent.click(screen.getByTestId('history-901-customer-chip'));
  await vi.waitFor(() => expect(list).toHaveBeenLastCalledWith(1, undefined, { ...scope, customerId: '0' }));
  expect(screen.getByTestId('order-filter-customer').textContent).toContain('Guest');
});

test('without filter fields the status cell is not a button', async () => {
  await setup([]);
  expect(screen.queryByTestId('history-901-status-filter')).toBeNull();
  expect(screen.getByTestId('history-901-customer-chip').getAttribute('role')).toBeNull();
});

// A till sale's status is its sync state, not a Woo status, so only store rows filter by status.
test('only store rows offer the status filter', async () => {
  await setup();
  const now = new Date().toISOString();
  await act(async () => { await localOrders!.insert({ id: 'local-1', createdAt: now, updatedAt: now, currency: 'USD',
    pricesIncludeTax: false, lines: [], subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0, customer: null,
    payments: [], syncStatus: 'applied', cashierRef: '2', commandId: 'command', taxRounding: { granularity: 'per_line_items', mode: 'half_up' } }); });
  await screen.findByTestId('order-row-local-1');
  expect(screen.getByTestId('history-901-status-filter')).not.toBeNull();
  expect(screen.queryByTestId('order-local-1-status-filter')).toBeNull();
});
