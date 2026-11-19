import { act, cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { OrderCreateEnvelope, StoreOrder, StoreOrderPage } from '@tallyui/core';
import { OrdersScreen } from '../components/orders-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import type { OrderHistorySource } from '../lib/orders/order-history';
import stores from './fixtures/stores.json';

// v2's syncing rows (data-table/index.tsx:199-202, :400-409): an empty list still loading shows five placeholder rows
// under the table's header, not a blank area.

function width(value: number) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: value, height: 800, scale: 1, fontScale: 1 });
}

beforeEach(() => {
  width(900);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z',
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600,
};

const applied = (envelope: OrderCreateEnvelope) => ({ id: envelope.id, status: 'applied' as const,
  serverRefs: { orderId: '305', displayId: '305', totalMinor: 300 } });

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function setup(list: OrderHistorySource['list']) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send: async batch => ({ kind: 'results', results: batch.map(applied) }) })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <OrdersScreen onBack={() => {}} history={{ list }} storeName={stores[0].name} cashierName="Paul" />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
}

const pending = () => new Promise<StoreOrderPage>(() => {});
const skeletonRows = (within_: Pick<typeof screen, 'queryAllByTestId'> = screen) => within_.queryAllByTestId(/^orders-skeleton-row-/);

// As orders-screen.test.tsx: RNW attaches onLayout to the node and jsdom has no ResizeObserver, so the test reports the
// list's viewport and its content's height.
type Measured = Element & { __reactLayoutHandler: (event: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void };
const report = (node: Element | null, height: number) =>
  (node as Measured).__reactLayoutHandler({ nativeEvent: { layout: { x: 0, y: 0, width: 900, height } } });
function measure(viewport: number, content: number) {
  const scroll = screen.getByTestId('orders-scroll');
  act(() => { report(scroll.firstElementChild, content); report(scroll, viewport); });
}

test('while the first page loads the table header stands over five placeholder rows', async () => {
  await setup(vi.fn<OrderHistorySource['list']>(pending));
  const loading = await screen.findByTestId('orders-loading');
  expect(loading.getAttribute('aria-busy')).toBe('true');
  expect(loading.getAttribute('aria-label')).toBe('Loading…');
  expect(skeletonRows(within(loading))).toHaveLength(5);
  expect(within(loading).getByTestId('orders-head-status')).not.toBeNull();
  expect(within(loading).getByTestId('orders-head-total')).not.toBeNull();
});

test('on a phone the first page shows five placeholder rows and no header', async () => {
  width(390);
  await setup(vi.fn<OrderHistorySource['list']>(pending));
  const loading = await screen.findByTestId('orders-loading');
  expect(skeletonRows(within(loading))).toHaveLength(5);
  expect(screen.queryByTestId('orders-head-status')).toBeNull();
});

test('once the first page arrives the placeholder rows go', async () => {
  let resolve!: (page: StoreOrderPage) => void;
  await setup(vi.fn<OrderHistorySource['list']>(() => new Promise<StoreOrderPage>(r => { resolve = r; })));
  expect(skeletonRows(within(await screen.findByTestId('orders-loading')))).toHaveLength(5);
  await act(async () => { resolve({ orders: [storeOrder], hasMore: false }); });
  expect(screen.getByTestId('history-row-901')).not.toBeNull();
  expect(screen.queryByTestId('orders-loading')).toBeNull();
  expect(skeletonRows()).toHaveLength(0);
});

test('a later page loading keeps the spinner and shows no placeholder rows', async () => {
  const list = vi.fn<OrderHistorySource['list']>()
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: true })
    .mockReturnValueOnce(pending());
  await setup(list);
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  measure(600, 300);
  expect(await screen.findByTestId('orders-page-spinner')).not.toBeNull();
  expect(list.mock.calls).toEqual([[1], [2]]);
  expect(skeletonRows()).toHaveLength(0);
  expect(screen.queryByTestId('orders-loading')).toBeNull();
});
