import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { StoreOrder } from '@tallyui/core';
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

function OrderStoreReady() {
  const outbox = useOutbox();
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
async function setup(fields: OrderHistorySource['fields'] = ['status', 'customerId', 'cashierId', 'storeId', 'createdVia', 'dateRange']) {
  const list = vi.fn<OrderHistorySource['list']>().mockResolvedValue({ orders: [order], hasMore: false });
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
