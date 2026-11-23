import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

addRxPlugin(RxDBMigrationSchemaPlugin);
const props: SaleScreenProps = {
  storeSettings: { ...noTaxSettings, preventOverselling: true },
  connector: createWooCommerceConnector(), currency: stores[0].currency,
  products: [{ ...products[0], stock_quantity: 3 }],
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  });
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function renderTill(preventOverselling = true) {
  const send = vi.fn(async () => ({ kind: 'results' as const, results: [] }));
  const storage = getRxStorageMemory();
  const till = (docs: SaleScreenProps['products']) => <SessionProvider>
    <OutboxProvider transportFor={() => ({ send })} storage={storage}>
      <OrderStoreReady />
      <SaleScreen {...props} products={docs} storeSettings={{ ...noTaxSettings, preventOverselling }} />
      <PortalHost />
    </OutboxProvider>
  </SessionProvider>;
  const view = render(till(props.products));
  await screen.findByText('Order store ready');
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId('product-tile-80'));
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('3');
  act(() => dismissToast());
  return { send, drop: (doc = { ...products[0], stock_quantity: 1 }) => view.rerender(till([doc])) };
}

const checkoutButton = () => screen.getByTestId('cart-checkout');

test('stock dropping under a cart line shows the notice, and Checkout stays on the cart', async () => {
  const app = await renderTill();
  expect(screen.queryByTestId('cart-conditions-notice')).toBeNull();
  app.drop();
  const row = within(screen.getByTestId('cart-conditions-notice')).getByRole('button');
  expect(within(row).getByText('Only 1 available for Espresso')).not.toBeNull();
  expect(within(row).getByText('Reduce')).not.toBeNull();
  fireEvent.click(checkoutButton());
  expect(checkoutButton()).not.toBeNull();
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('3');
  expect(screen.queryByTestId('checkout-keypad')).toBeNull();
  expect(app.send).not.toHaveBeenCalled();
  expect(getToasts()).toEqual([]);
}, 20_000);

test('Reduce sets the line to what fits and clears the notice, and Checkout then opens the tender', async () => {
  const app = await renderTill();
  app.drop();
  fireEvent.click(within(screen.getByTestId('cart-conditions-notice')).getByRole('button'));
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('1');
  expect(screen.queryByTestId('cart-conditions-notice')).toBeNull();
  fireEvent.click(checkoutButton());
  expect(await screen.findByTestId('checkout-keypad')).not.toBeNull();
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  expect(screen.getByTestId('checkout-method-pos_cash').getAttribute('aria-selected')).toBe('true');
}, 20_000);

test('Remove takes an out-of-stock line out of the cart', async () => {
  const app = await renderTill();
  app.drop({ ...products[0], manage_stock: false, stock_status: 'outofstock' });
  const row = within(screen.getByTestId('cart-conditions-notice')).getByRole('button');
  expect(within(row).getByText('Espresso out of stock')).not.toBeNull();
  expect(within(row).getByText('Remove')).not.toBeNull();
  fireEvent.click(row);
  expect(screen.queryByLabelText('Edit quantity of Espresso')).toBeNull();
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  expect(screen.queryByTestId('cart-conditions-notice')).toBeNull();
}, 20_000);

test('with prevent overselling off, no notice and Checkout opens the tender', async () => {
  const app = await renderTill(false);
  app.drop();
  expect(screen.queryByTestId('cart-conditions-notice')).toBeNull();
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('3');
  fireEvent.click(checkoutButton());
  expect(await screen.findByTestId('checkout-keypad')).not.toBeNull();
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
}, 20_000);
