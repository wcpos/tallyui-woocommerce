// v2's Total display line (initial-settings.json:466-475, orders/cells/total.tsx:25 and :52-56): Order Settings >
// Columns > Total carries a nested "Payment Method" switch, off by default; on, the table's Total cell shows the
// payment title under the total in v2's `key` rank. v2's phone row (orders/row.tsx:34-38) never draws it.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { StoreOrder } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { AppRailShown } from '../components/app-rail';
import { OrdersScreen } from '../components/orders-screen';
import { OrdersTable } from '../components/orders-table';
import { areaColumnsKey } from '../lib/area-columns';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider } from '../lib/sale/outbox-context';
import { classesOf } from './classes-of';
import { memoryStorage } from './memory-storage';

const storeOrder: StoreOrder = {
  id: '901', reference: '901', status: 'on-hold', placedAt: new Date(2026, 10, 10, 10, 0).toISOString(),
  currency: 'USD', pricesIncludeTax: false, customer: null,
  lines: [{ id: '1', name: 'Espresso', quantity: 2, subtotalMinor: 600, subtotalTaxMinor: 0, totalMinor: 600, taxMinor: 0 }],
  fees: [], shipping: [], coupons: [], taxLines: [], refunds: [],
  payments: [{ method: 'pos_cash', title: 'Cash', kind: 'cash', amountMinor: 600 }],
  discountMinor: 0, discountTaxMinor: 0, taxMinor: 0, totalMinor: 600,
};
const refunded: StoreOrder = { ...storeOrder, id: '930', reference: '930', refunds: [{ id: 'r1', amountMinor: 450 }] };
const unpaid: StoreOrder = { ...storeOrder, id: '932', reference: '932', payments: [] };
const now = new Date(2026, 10, 10, 15, 0);
const NESTED = 'orders-display-column-total-payment_method';

const setWidth = (width: number) => vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });

beforeEach(() => {
  setWidth(1280);
  vi.stubGlobal('localStorage', memoryStorage());
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: 'Shop', home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000, user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderOrders() {
  render(<SessionProvider>
    <OutboxProvider transportFor={() => ({ send: vi.fn() })} storage={getRxStorageMemory()}>
      <AppRailShown.Provider value>
        <OrdersScreen onBack={vi.fn()} history={{ list: async () => ({ orders: [storeOrder], hasMore: false }) }} storeName="Shop" cashierName="Paul" />
      </AppRailShown.Provider>
      <PortalHost />
    </OutboxProvider>
  </SessionProvider>);
  await screen.findByTestId('history-row-901');
}

test("Order Settings' Total carries v2's nested Payment Method switch, off, one gutter in, only while Total shows", async () => {
  await renderOrders();
  fireEvent.click(screen.getByTestId('orders-bar-display'));
  const nested = screen.getByTestId('orders-display-column-total-display');
  expect(classesOf('orders-display-column-total-display')).toContain('pl-12');
  const toggle = within(nested).getByTestId(NESTED);
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(nested.textContent).toBe('Payment Method');
  expect(within(nested).getAllByRole('switch')).toHaveLength(1);

  fireEvent.click(screen.getByTestId('orders-display-column-total'));
  expect(screen.queryByTestId('orders-display-column-total-display')).toBeNull();
  expect(screen.queryByTestId(NESTED)).toBeNull();
  fireEvent.click(screen.getByTestId('orders-display-column-total'));
  expect(screen.getByTestId(NESTED).getAttribute('aria-checked')).toBe('false');
});

test("with Payment Method on, the table's Total cell shows the payment title under the total in v2's key rank", () => {
  render(<OrdersTable local={[]} store={[storeOrder, refunded, unpaid]} onOpen={vi.fn()} showPayment now={() => now} />);
  const line = screen.getByTestId('order-total-payment-901');
  expect(line.textContent).toBe('Cash');
  expect(classesOf('order-total-payment-901')).toEqual(expect.arrayContaining(['text-right', 'text-sm', 'text-muted-foreground']));
  expect(screen.getByTestId('history-901-total').contains(line)).toBe(true);
  expect(screen.getByTestId('history-901-total').textContent).toBe('$6.00Cash');
  // v2 draws it after the refunds line (cells/total.tsx:49-56).
  expect(screen.getByTestId('history-930-total').textContent).toBe('$6.00-$4.50Cash');
  expect(screen.getByTestId('order-total-refunds-930').nextElementSibling).toBe(screen.getByTestId('order-total-payment-930'));
  // An order with no payment title draws no line.
  expect(screen.queryByTestId('order-total-payment-932')).toBeNull();
  expect(screen.getByTestId('history-932-total').textContent).toBe('$6.00');
});

test("the phone row draws no payment line under its total, as v2's row.tsx: the payment stays on its second line", () => {
  setWidth(390);
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={vi.fn()} showPayment now={() => now} />);
  expect(screen.queryByTestId('orders-table')).toBeNull();
  expect(screen.queryByTestId('order-total-payment-901')).toBeNull();
  expect(screen.getByTestId('history-901-payment').textContent).toBe('· Cash');
});

test('with Payment Method off, the default, no payment line is drawn', async () => {
  await renderOrders();
  expect(screen.queryByTestId('order-total-payment-901')).toBeNull();
  expect(screen.getByTestId('history-901-total').textContent).toBe('$6.00');
  cleanup();
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={vi.fn()} now={() => now} />);
  expect(screen.getByTestId('history-901-total').textContent).toBe('$6.00');
  expect(screen.queryByTestId('order-total-payment-901')).toBeNull();
});

test('the Payment Method choice survives a remount, and Restore turns it off', async () => {
  await renderOrders();
  fireEvent.click(screen.getByTestId('orders-bar-display'));
  fireEvent.click(screen.getByTestId(NESTED));
  expect(screen.getByTestId(NESTED).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('order-total-payment-901').textContent).toBe('Cash');
  const stored = JSON.parse(localStorage.getItem(areaColumnsKey('orders'))!) as { id: string }[];
  expect(stored.find(row => row.id === 'total')).toEqual({ id: 'total', visible: true, display: [{ id: 'payment_method', visible: true }] });

  cleanup();
  await renderOrders();
  expect(screen.getByTestId('order-total-payment-901').textContent).toBe('Cash');

  fireEvent.click(screen.getByTestId('orders-bar-display'));
  expect(screen.getByTestId(NESTED).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByTestId('orders-display-restore'));
  expect(screen.getByTestId(NESTED).getAttribute('aria-checked')).toBe('false');
  expect(screen.queryByTestId('order-total-payment-901')).toBeNull();
});
