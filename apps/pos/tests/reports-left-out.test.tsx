import { setLineQuantity, EMPTY_CART_TEXT } from './cart-line-helpers';
// Uniwind's runtime does not load under Vitest; the report cards' donut reads fixed colours.
vi.mock('uniwind', () => ({ Uniwind: { setTheme: vi.fn() }, useCSSVariable: (names: string[]) => names.map(() => '#000000') }));
import { noTaxSettings } from './fixtures/store-settings';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { ReportsScreen } from '../components/reports-screen';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { sessionsOff } from './cart-head-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { classesOf } from './classes-of';

// v2 reports/panels/orders-panel.tsx, hero/index.tsx `LeftOutChip`, cards/orders.tsx and context.tsx `selectedOrders`:
// an unticked order drops out of every figure until it is ticked again or "Put them back" clears the set.

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  sessionsOff();
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const text = (testID: string) => screen.getByTestId(testID).textContent;

/** Rings up two cash sales, an Espresso ($3.00) and two Espressos ($6.00), and returns their order ids, $3.00 first. */
async function twoSales() {
  let outbox!: ReturnType<typeof useOutbox>;
  let register!: ReturnType<typeof useRegister>;
  function Probe() { outbox = useOutbox(); register = useRegister(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <RegisterProvider>
          <Probe />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} locale={stores[0].locale} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            onSwitchCashier={async () => null} cashiers={[]} />
          <ReportsScreen storeName={stores[0].name} currency={stores[0].currency} locale={stores[0].locale} onBack={vi.fn()} />
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  for (const quantity of [1, 2]) {
    fireEvent.click(within(screen.getByTestId('product-tile-80')).getByText('Espresso'));
    if (quantity > 1) setLineQuantity('Espresso', quantity);
    fireEvent.click(screen.getByTestId('cart-checkout'));
    await takeCash(1000);
    expect(await screen.findByTestId('receipt-order')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
    await screen.findByText(EMPTY_CART_TEXT);
  }
  await waitFor(() => expect(text('hero-total')).toBe('$9.00'));
  if (!outbox.enabled || !outbox.orders) throw new Error('Order store not ready');
  const orders = await outbox.orders.find().exec();
  const small = orders.find(order => order.totalMinor === 300)!.id;
  const large = orders.find(order => order.totalMinor === 600)!.id;
  fireEvent.click(screen.getByTestId('sales-room-orders-open'));
  await screen.findByTestId('sales-table');
  return { small, large };
}

test('unticking one order lowers the hero total and Orders count, and the counted line reads "1 of 2 counted · the numbers follow"', async () => {
  const { small, large } = await twoSales();
  expect(text('sales-table-status')).toBe('2 of 2 counted');
  const tick = screen.getByTestId(`orders-panel-tick-${small}`);
  expect(tick.getAttribute('aria-label')).toMatch(/^Include order /);
  expect(tick.getAttribute('aria-checked')).toBe('true');
  fireEvent.click(tick);
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  expect(text('hero-orders')).toBe('1');
  expect(text('sales-table-status')).toBe('1 of 2 counted · the numbers follow');
  expect(screen.getByTestId(`orders-panel-tick-${small}`).getAttribute('aria-checked')).toBe('false');
  // The unticked order stays listed, dimmed, and the footer sums only the counted one.
  expect(classesOf(`sales-table-row-${small}`)).toContain('opacity-50');
  expect(classesOf(`sales-table-row-${large}`)).not.toContain('opacity-50');
  expect(within(screen.getByTestId('sales-table-total')).getAllByText(/./).map(cell => cell.textContent)).toEqual(['Counted', '$6.00']);
  expect(text('orders-panel-left-out')).toBe('1 left out');
  fireEvent.click(screen.getByTestId(`orders-panel-tick-${small}`));
  await waitFor(() => expect(text('hero-total')).toBe('$9.00'));
  expect(text('sales-table-status')).toBe('2 of 2 counted');
}, 30_000);

test('tick-all off leaves every order out and the Orders card reads "Every order is left out"; tick-all on puts them back', async () => {
  await twoSales();
  const all = () => screen.getByTestId('orders-panel-tick-all');
  expect(all().getAttribute('aria-label')).toBe('Toggle selection');
  expect(within(screen.getByTestId('orders-panel-tick-all-row')).getByText('All orders')).not.toBeNull();
  expect(all().getAttribute('aria-checked')).toBe('true');
  fireEvent.click(all());
  await waitFor(() => expect(text('hero-total')).toBe('$0.00'));
  expect(text('sales-table-status')).toBe('0 of 2 counted · the numbers follow');
  expect(text('orders-panel-left-out')).toBe('2 left out');
  expect(all().getAttribute('aria-checked')).toBe('false');
  expect(text('card-orders-empty')).toBe('Every order is left out');
  fireEvent.click(all());
  await waitFor(() => expect(text('hero-total')).toBe('$9.00'));
  expect(text('sales-table-status')).toBe('2 of 2 counted');
  expect(all().getAttribute('aria-checked')).toBe('true');
  expect(screen.queryByTestId('card-orders-empty')).toBeNull();
}, 30_000);

test('the hero chip reads "1 order left out" and Put them back restores the totals', async () => {
  const { small, large } = await twoSales();
  expect(screen.queryByTestId('hero-chip-left-out')).toBeNull();
  fireEvent.click(screen.getByTestId(`orders-panel-tick-${small}`));
  await waitFor(() => expect(text('hero-chip-left-out')).toBe('1 order left out'));
  fireEvent.click(screen.getByTestId(`orders-panel-tick-${large}`));
  await waitFor(() => expect(text('hero-chip-left-out')).toBe('2 orders left out'));
  // The chip sits in the scope chips row after the cashier chip, as v2's SettledChips.
  expect(within(screen.getByTestId('hero-chips')).getByTestId('hero-chip-left-out')).not.toBeNull();
  fireEvent.click(screen.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  const clear = screen.getByTestId('hero-chip-left-out-clear');
  expect(clear.getAttribute('aria-label')).toBe('Put them back');
  fireEvent.click(clear);
  await waitFor(() => expect(text('hero-total')).toBe('$9.00'));
  expect(text('hero-orders')).toBe('2');
  expect(screen.queryByTestId('hero-chip-left-out')).toBeNull();
}, 30_000);

test('the hero chip opens the Orders table', async () => {
  const { small } = await twoSales();
  fireEvent.click(screen.getByTestId(`orders-panel-tick-${small}`));
  await screen.findByTestId('hero-chip-left-out');
  fireEvent.click(screen.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  fireEvent.click(screen.getByTestId('hero-chip-left-out'));
  expect(within(await screen.findByTestId('sales-table')).getByText('Orders')).not.toBeNull();
  expect(text('sales-table-status')).toBe('1 of 2 counted · the numbers follow');
}, 30_000);

test('the Payments table follows the left-out set', async () => {
  const { small } = await twoSales();
  fireEvent.click(screen.getByTestId(`orders-panel-tick-${small}`));
  await waitFor(() => expect(text('hero-total')).toBe('$6.00'));
  fireEvent.click(screen.getByTestId('sales-table-close'));
  await waitFor(() => expect(screen.queryByTestId('sales-table')).toBeNull());
  fireEvent.click(screen.getByTestId('card-payments-open'));
  const table = within(await screen.findByTestId('sales-table'));
  expect(within(table.getByTestId('sales-table-row-cash')).getAllByText(/./).map(cell => cell.textContent)).toEqual([
    'Cash', '1', '$6.00', '100.0%',
  ]);
  expect(table.getByTestId('sales-table-status').textContent).toBe('1 order · $6.00');
  // Only the Orders table carries tick boxes.
  expect(table.queryByTestId('orders-panel-tick-all')).toBeNull();
}, 30_000);
