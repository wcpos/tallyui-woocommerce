import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import type { StoreOrder } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { AppRailShown } from '../components/app-rail';
import { OrdersScreen } from '../components/orders-screen';
import { ORDERS_COLUMNS, OrdersTable } from '../components/orders-table';
import { areaColumnsKey, loadAreaColumns, saveAreaColumns } from '../lib/area-columns';
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
const LABELS = ['Status', 'Order Number', 'Customer', 'Date Created', 'Payment Method', 'Total'];
const IDS = ['status', 'number', 'customer_id', 'date_created_gmt', 'payment_method', 'total'];
const defaults = ORDERS_COLUMNS.map(({ id, visible }) => ({ id, visible }));

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
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

const headers = () => Array.from(screen.getByTestId('orders-table').querySelectorAll('[role="columnheader"], th'))
  .map(node => node.textContent).filter(Boolean);
const row = () => within(screen.getByTestId('history-row-901'));

test("the Orders bar draws v2's display options before the bell", async () => {
  await renderOrders();
  const ids = Array.from(screen.getByTestId('orders-bar-controls').querySelectorAll('[data-testid]'))
    .map(node => node.getAttribute('data-testid'))
    .filter(id => ['orders-bar-display', 'orders-bar-bell', 'orders-bar-avatar'].includes(id!));
  expect(ids).toEqual(['orders-bar-display', 'orders-bar-bell', 'orders-bar-avatar']);
  expect(screen.getByTestId('orders-bar-display').getAttribute('aria-label')).toBe('Display options');
});

test("it opens Order Settings with one switch per column in v2's order, all on", async () => {
  await renderOrders();
  fireEvent.click(screen.getByTestId('orders-bar-display'));
  const panel = screen.getByTestId('orders-display-options');
  expect(within(panel).getByText('Order Settings')).not.toBeNull();
  const switches = Array.from(panel.querySelectorAll('[role="switch"]'));
  expect(switches.map(node => node.getAttribute('data-testid'))).toEqual(IDS.map(id => `orders-display-column-${id}`));
  expect(switches.map(node => node.getAttribute('aria-checked'))).toEqual(IDS.map(() => 'true'));
  const text = panel.textContent!;
  const positions = [...LABELS, 'Restore Default Settings', 'Close'].map(label => text.indexOf(label));
  expect(positions[0]).toBeGreaterThanOrEqual(0);
  for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
  fireEvent.click(screen.getByTestId('orders-display-close'));
  expect(screen.queryByTestId('orders-display-options')).toBeNull();
});

test('switching Payment Method off hides its header and cells, survives a remount, and Restore brings it back', async () => {
  await renderOrders();
  expect(headers()).toEqual(LABELS);
  expect(row().queryByText('Cash')).not.toBeNull();
  fireEvent.click(screen.getByTestId('orders-bar-display'));
  fireEvent.click(screen.getByTestId('orders-display-column-payment_method'));
  expect(screen.getByTestId('orders-display-column-payment_method').getAttribute('aria-checked')).toBe('false');
  expect(headers()).toEqual(LABELS.filter(label => label !== 'Payment Method'));
  expect(row().queryByText('Cash')).toBeNull();
  expect(row().getByText('$6.00')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(areaColumnsKey('orders'))!))
    .toEqual(IDS.map(id => ({ id, visible: id !== 'payment_method' })));

  cleanup();
  await renderOrders();
  expect(headers()).toEqual(LABELS.filter(label => label !== 'Payment Method'));
  expect(row().queryByText('Cash')).toBeNull();

  fireEvent.click(screen.getByTestId('orders-bar-display'));
  fireEvent.click(screen.getByTestId('orders-display-restore'));
  expect(screen.getByTestId('orders-display-column-payment_method').getAttribute('aria-checked')).toBe('true');
  expect(headers()).toEqual(LABELS);
  expect(row().getByText('Cash')).not.toBeNull();
  expect(loadAreaColumns('orders', ORDERS_COLUMNS)).toEqual(defaults);
});

test('the table draws only the visible columns, in its own order, and keeps the chevron', () => {
  render(<OrdersTable local={[]} store={[storeOrder]} onOpen={vi.fn()} visible={['total', 'status']} now={() => new Date(2026, 10, 10, 15, 0)} />);
  expect(headers()).toEqual(['Status', 'Total']);
  expect(row().queryByText('901')).toBeNull();
  expect(row().getByText('On hold')).not.toBeNull();
  expect(screen.getByTestId('history-open-901')).not.toBeNull();
});

test('a saved choice loads back, and stores only id and visible', () => {
  const storage = memoryStorage();
  saveAreaColumns('orders', ORDERS_COLUMNS.map(column => ({ ...column, visible: column.id !== 'customer_id' })), storage);
  expect(JSON.parse(storage.getItem(areaColumnsKey('orders'))!)[0]).toEqual({ id: 'status', visible: true });
  expect(loadAreaColumns('orders', ORDERS_COLUMNS, storage)).toEqual(IDS.map(id => ({ id, visible: id !== 'customer_id' })));
});

test('an unknown id, a missing id, a malformed row or invalid JSON falls back to the defaults', () => {
  const storage = memoryStorage();
  const key = areaColumnsKey('orders');
  storage.setItem(key, JSON.stringify([{ id: 'billing', visible: false }, { id: 'total', visible: false }, { id: 'status', visible: 'no' }]));
  expect(loadAreaColumns('orders', ORDERS_COLUMNS, storage)).toEqual(IDS.map(id => ({ id, visible: id !== 'total' })));
  storage.setItem(key, '{not json');
  expect(loadAreaColumns('orders', ORDERS_COLUMNS, storage)).toEqual(defaults);
  storage.setItem(key, JSON.stringify({ columns: [] }));
  expect(loadAreaColumns('orders', ORDERS_COLUMNS, storage)).toEqual(defaults);
  expect(loadAreaColumns('orders', ORDERS_COLUMNS, memoryStorage())).toEqual(defaults);
});

test("the display options tooltip shows on hover and is gone once Order Settings opens, as v2's closes on click", async () => {
  await renderOrders();
  const button = screen.getByTestId('orders-bar-display');
  // A press with no hover first (a touch) opens the panel and no tooltip.
  fireEvent.click(button);
  expect(screen.getByTestId('orders-display-options')).not.toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.click(screen.getByTestId('orders-display-close'));
  fireEvent.pointerEnter(button);
  expect(screen.getByRole('tooltip').textContent).toBe('Order Settings');
  fireEvent.click(button);
  expect(screen.getByTestId('orders-display-options')).not.toBeNull();
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test("Order Settings keeps v2's 16 px leading-none title, its 20 px switch and its outline Close with a light border", async () => {
  await renderOrders();
  fireEvent.click(screen.getByTestId('orders-bar-display'));
  expect(screen.getByTestId('orders-display-title').textContent).toBe('Order Settings');
  // v2's dialog rank is text-lg, 16 px on the 14 px ramp global.css takes from v2.
  expect(classesOf('orders-display-title')).toEqual(expect.arrayContaining(['text-lg', 'leading-none']));
  expect(classesOf('orders-display-title')).not.toContain('text-base');
  expect(classesOf('orders-display-column-status')).toEqual(expect.arrayContaining(['h-5', 'w-9']));
  expect(classesOf('orders-display-column-status')).not.toContain('-my-0.5');
  const close = classesOf('orders-display-close');
  expect(close).toEqual(expect.arrayContaining(['border', 'border-border', 'bg-card']));
  expect(close).not.toContain('border-input');
  expect(close).not.toContain('bg-background');
});

test("Restore Default Settings is v2's outline-destructive: a red border on the card, the label in the foreground", async () => {
  await renderOrders();
  fireEvent.click(screen.getByTestId('orders-bar-display'));
  expect(classesOf('orders-display-restore')).toEqual(expect.arrayContaining(['border-destructive', 'bg-card']));
  expect(classesOf('orders-display-restore-label')).toContain('text-foreground');
  expect(classesOf('orders-display-restore-label')).not.toContain('text-destructive');
});

test("Order Settings' Restore and Close are v2's h-ctl footer buttons, 44 px: h-11 over TallyUI's h-10", async () => {
  await renderOrders();
  fireEvent.click(screen.getByTestId('orders-bar-display'));
  for (const testID of ['orders-display-restore', 'orders-display-close']) {
    expect(classesOf(testID), testID).toContain('h-11');
    expect(classesOf(testID), testID).not.toContain('h-10');
  }
});
