import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope, StoreOrder, StoreOrderPage } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { OrdersScreen } from '../components/orders-screen';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import type { OrderHistorySource } from '../lib/orders/order-history';
import { dayKey } from '../lib/orders/order-days';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

const props: ComponentProps<typeof SaleScreen> = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
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

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function setup(send: CommandTransport<OrderCreateEnvelope>['send'], history: OrderHistorySource | null = null, withSale = true) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        {withSale && <SaleScreen {...props} />}
        <OrdersScreen onBack={() => {}} history={history} storeName={props.storeName} cashierName={props.cashierName} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await vi.waitFor(() => expect(screen.getByText('Order store ready')).not.toBeNull());
}

async function payCash() {
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  await takeCash(300);
  await vi.waitFor(() => expect(screen.getByTestId('receipt-order')).not.toBeNull());
  return /^Order ([a-f0-9]{8})/.exec(screen.getByTestId('receipt-order').textContent!)![1];
}

const table = () => within(screen.getByTestId('orders-table'));

const applied = (envelope: OrderCreateEnvelope) => ({ id: envelope.id, status: 'applied' as const,
  serverRefs: { orderId: '305', displayId: '305', totalMinor: 300 } });

test('a sent sale is listed under Today', async () => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await setup(send);
  const reference = await payCash();
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(table().getByText(`${reference} · #305`)).not.toBeNull());
  expect(table().getByText('Synced')).not.toBeNull();
  expect(table().getByText('$3.00')).not.toBeNull();
  expect(screen.getByTestId(`orders-day-heading-${dayKey(new Date())}`).textContent).toBe('Today');
}, 20_000);

test('a refused sale shows Not accepted, and Orders offers no Retry', async () => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({ kind: 'results', results: batch.map(applied) }));
  send.mockImplementationOnce(async batch => ({ kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'rejected',
    error: { code: 'store_configuration', message: 'A store setting needs changing.' } })) }));
  await setup(send);
  const reference = await payCash();
  await vi.waitFor(() => expect(table().getByText('Not accepted')).not.toBeNull());
  expect(table().getByText(reference)).not.toBeNull();
  expect(table().queryByRole('button', { name: 'Retry' })).toBeNull();
  expect(screen.queryByRole('heading', { name: 'Needs attention' })).toBeNull();
  expect(send).toHaveBeenCalledTimes(1);
}, 20_000);

test('without a store it says so', () => {
  render(<SessionProvider><OutboxProvider transportFor={() => null}>
    <OrdersScreen onBack={() => {}} history={null} storeName={props.storeName} cashierName={props.cashierName} />
  </OutboxProvider></SessionProvider>);
  expect(screen.getByText('Orders show once the store is connected.')).not.toBeNull();
  expect(screen.queryByTestId('orders-table')).toBeNull();
});

const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'completed', placedAt: '2026-10-15T10:00:00Z',
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600,
};

test('store history opens its detail, and Receipt there opens the reprint', async () => {
  const list = vi.fn<OrderHistorySource['list']>(async () => ({ orders: [storeOrder], hasMore: false }));
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  expect(within(screen.getByTestId('history-row-901')).getByText('Completed')).not.toBeNull();
  fireEvent.click(screen.getByTestId(`history-open-${storeOrder.id}`));
  expect(screen.getByTestId('order-modal-title').textContent).toBe('Order #901');
  expect(screen.getByTestId('order-modal-status').textContent).toBe('Completed');
  expect(screen.queryByPlaceholderText('Search Orders')).toBeNull();
  expect(screen.queryByTestId('receipt-reprint')).toBeNull();
  act(() => {
    for (const key of [...'12345678', 'Enter']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
  });
  expect(list).toHaveBeenCalledTimes(1);
  const back = () => screen.getAllByRole('button', { name: 'Back' }).find(button => button.getAttribute('data-testid') !== 'orders-back')!;
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  expect(screen.getByTestId('receipt-reprint').textContent).toBe('Reprint 1');
  expect(screen.getByTestId('receipt-order').textContent).toBe('Order 901');
  fireEvent.click(back());
  expect(screen.getByTestId('order-modal-title')).not.toBeNull();
  fireEvent.click(screen.getByTestId('order-modal-receipt'));
  expect(screen.getByTestId('receipt-reprint').textContent).toBe('Reprint 2');
  fireEvent.click(back());
  fireEvent.click(screen.getByTestId('order-modal-close'));
  expect(screen.getByTestId('history-row-901')).not.toBeNull();
  expect((screen.getByPlaceholderText('Search Orders') as HTMLInputElement).value).toBe('');
  expect(list).toHaveBeenCalledTimes(1);
});

test('a till sale opens as a reprint', async () => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await setup(send);
  const reference = await payCash();
  await vi.waitFor(() => expect(table().getByText(`${reference} · #305`)).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  fireEvent.click(screen.getByTestId(/^order-open-/));
  expect(screen.getByTestId('receipt-reprint').textContent).toBe('Reprint 1');
  expect(screen.getByTestId('receipt-order').textContent).toBe(`Order ${reference} · #305`);
}, 20_000);

test('Load more fetches the next page', async () => {
  const next = { ...storeOrder, id: '902', reference: '902' };
  const list = vi.fn<OrderHistorySource['list']>()
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: true })
    .mockResolvedValueOnce({ orders: [storeOrder, next], hasMore: false });
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  fireEvent.click(await screen.findByTestId('orders-load-more'));
  expect(await screen.findByTestId('history-row-902')).not.toBeNull();
  expect(screen.getAllByTestId('history-row-901')).toHaveLength(1);
  expect(screen.queryByTestId('orders-load-more')).toBeNull();
  expect(list.mock.calls).toEqual([[1], [2]]);
});

test('a failed history load says so and Try again reloads', async () => {
  const list = vi.fn<OrderHistorySource['list']>()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: false });
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  expect(await screen.findByText("Store orders couldn't be loaded.")).not.toBeNull();
  fireEvent.click(screen.getByTestId('orders-history-retry'));
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  expect(list.mock.calls).toEqual([[1], [1]]);
});

test('Search Orders asks the store after a pause and starts again at page 1', async () => {
  const list = vi.fn<OrderHistorySource['list']>()
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: true })
    .mockResolvedValueOnce({ orders: [{ ...storeOrder, id: '903', reference: '903' }], hasMore: false })
    .mockResolvedValueOnce({ orders: [{ ...storeOrder, id: '902', reference: '902' }], hasMore: false });
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  fireEvent.click(await screen.findByTestId('orders-load-more'));
  expect(await screen.findByTestId('history-row-903')).not.toBeNull();
  const input = screen.getByPlaceholderText('Search Orders');
  fireEvent.change(input, { target: { value: '9' } });
  fireEvent.change(input, { target: { value: '90' } });
  fireEvent.change(input, { target: { value: '902' } });
  expect(await screen.findByTestId('history-row-902')).not.toBeNull();
  expect(screen.queryByTestId('history-row-901')).toBeNull();
  expect(screen.queryByTestId('history-row-903')).toBeNull();
  expect(screen.queryByTestId('orders-load-more')).toBeNull();
  expect(list.mock.calls).toEqual([[1], [2], [1, '902']]);
});

test('a slower earlier search does not replace a later one', async () => {
  let resolveFirst!: (page: StoreOrderPage) => void;
  const list = vi.fn<OrderHistorySource['list']>()
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: false })
    .mockReturnValueOnce(new Promise<StoreOrderPage>(resolve => { resolveFirst = resolve; }))
    .mockResolvedValueOnce({ orders: [{ ...storeOrder, id: '902', reference: '902' }], hasMore: false });
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  const input = screen.getByPlaceholderText('Search Orders');
  fireEvent.change(input, { target: { value: '903' } });
  await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  fireEvent.change(input, { target: { value: '902' } });
  expect(await screen.findByTestId('history-row-902')).not.toBeNull();
  await act(async () => {
    resolveFirst({ orders: [{ ...storeOrder, id: '903', reference: '903' }], hasMore: false });
  });
  expect(screen.queryByTestId('history-row-903')).toBeNull();
  expect(screen.getByTestId('history-row-902')).not.toBeNull();
});

test("Search Orders filters this till's own sales", async () => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({ kind: 'results', results: batch.map(applied) }));
  await setup(send);
  const reference = await payCash();
  const row = `${reference} · #305`;
  await vi.waitFor(() => expect(table().getByText(row)).not.toBeNull());
  const input = screen.getByPlaceholderText('Search Orders');
  fireEvent.change(input, { target: { value: 'latte' } });
  expect((await screen.findByTestId('no-data-message-title')).textContent).toBe('No orders match these filters');
  expect(screen.queryByTestId('orders-table')).toBeNull();
  fireEvent.change(input, { target: { value: reference } });
  await vi.waitFor(() => expect(table().getByText(row)).not.toBeNull());
}, 20_000);

test('with nothing matching it says so and Clear filters lists every order again', async () => {
  const list = vi.fn<OrderHistorySource['list']>()
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: false })
    .mockResolvedValueOnce({ orders: [], hasMore: false })
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: false });
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  const input = screen.getByPlaceholderText('Search Orders') as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'nope' } });
  expect(await screen.findByText('No orders match these filters')).not.toBeNull();
  fireEvent.click(screen.getByTestId('no-data-message-action'));
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  expect(input.value).toBe('');
  expect(list.mock.calls).toEqual([[1], [1, 'nope'], [1]]);
});

test("with no orders it shows v2's empty copy", async () => {
  const list = vi.fn<OrderHistorySource['list']>().mockResolvedValue({ orders: [], hasMore: false });
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list });
  expect((await screen.findByTestId('no-data-message-title')).textContent).toBe('No orders yet');
  expect(screen.getByTestId('no-data-message-description').textContent).toBe('Sales you take will appear here.');
  expect(screen.queryByTestId('no-data-message-action')).toBeNull();
});

test('a wedge scan searches Orders at once', async () => {
  const list = vi.fn<OrderHistorySource['list']>()
    .mockResolvedValueOnce({ orders: [storeOrder], hasMore: false })
    .mockResolvedValueOnce({ orders: [{ ...storeOrder, id: '902', reference: '902' }], hasMore: false });
  await setup(async batch => ({ kind: 'results', results: batch.map(applied) }), { list }, false);
  expect(await screen.findByTestId('history-row-901')).not.toBeNull();
  act(() => {
    for (const key of [...'12345678', 'Enter']) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
  });
  expect((screen.getByPlaceholderText('Search Orders') as HTMLInputElement).value).toBe('12345678');
  expect(await screen.findByTestId('history-row-902')).not.toBeNull();
  expect(list.mock.calls).toEqual([[1], [1, '12345678']]);
});
