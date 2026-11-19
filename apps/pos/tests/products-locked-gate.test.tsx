import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { classesOf } from './classes-of';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { openRegisterPanel, sessionsOff, toggleRegisterSessions } from './cart-head-helpers';

// WCPOS v2 (monorepo origin/main): a closed register makes the till a price check and a counting one refuses adds
// (pos/hooks/use-add-product.ts:28-45,77-85, use-barcode.ts:173-181), and the products column says so
// (pos/products/index.tsx:539-550,615,619; core.json:1231-1232).
const PRICE_CHECK = 'Price check only until the register is open.';
const COUNTING = 'Counting the drawer. Items can be added after the count.';
const priceCheckToast = { id: 'pos-price-check-refused', type: 'info', title: PRICE_CHECK };
const countingToast = { id: 'pos-counting-refused', type: 'info', title: COUNTING };
const refusals = () => getToasts().filter(item => item.id.endsWith('-refused'));
const espressoInCart = () => screen.queryByTestId('in-cart-tile-80')?.textContent ?? null;

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  sessionsOff();
  // These tests tap Espresso on the flat product grid.
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => { cleanup(); dismissToast(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function setup() {
  let register!: ReturnType<typeof useRegister>;
  let outbox!: ReturnType<typeof useOutbox>;
  function Probe() { register = useRegister(); outbox = useOutbox(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <RegisterProvider>
          <Probe />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            onSwitchCashier={async () => null} cashiers={[]} />
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  if (!outbox.enabled || !outbox.orders) throw new Error('Order store not ready');
  return { get register() { return register; } };
}

async function closedTill() {
  const app = await setup();
  await toggleRegisterSessions();
  await screen.findByTestId('open-register-card');
  await waitFor(() => expect(app.register.enabled).toBe(true));
  return app;
}

async function openRegister(app: Awaited<ReturnType<typeof setup>>) {
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
}

test('closed with sessions on: a tap adds nothing, the price-check toast shows, and the notice shows the lock glyph', async () => {
  const app = await closedTill();
  expect(screen.getByTestId('products-locked-notice-title').textContent).toBe(PRICE_CHECK);
  expect(screen.getByTestId('products-locked-notice-lock')).not.toBeNull();
  expect(screen.queryByTestId('products-locked-notice-info')).toBeNull();
  dismissToast();
  fireEvent.click(screen.getByText('Espresso'));
  expect(getToasts()).toEqual([expect.objectContaining(priceCheckToast)]);
  expect(espressoInCart()).toBeNull();
  await openRegister(app);
  expect(await screen.findByTestId('cart-empty')).not.toBeNull();
  expect(espressoInCart()).toBeNull();
  await waitFor(() => expect(screen.queryByTestId('products-locked-notice')).toBeNull());
});

test('counting: a tap adds nothing, the counting toast shows, the notice shows the info glyph, and the products are dimmed', async () => {
  const app = await closedTill();
  await openRegister(app);
  fireEvent.click(screen.getByText('Espresso'));
  await waitFor(() => expect(espressoInCart()).toBe('1'));
  await openRegisterPanel();
  fireEvent.click(screen.getByTestId('register-panel-close'));
  await screen.findByTestId('count-amount');
  await waitFor(() => expect(app.register.session?.status).toBe('counting'));
  dismissToast();
  fireEvent.click(screen.getAllByText('Espresso')[0]);
  expect(refusals()).toEqual([expect.objectContaining(countingToast)]);
  expect(espressoInCart()).toBe('1');
  expect(screen.getByTestId('products-locked-notice-title').textContent).toBe(COUNTING);
  expect(screen.getByTestId('products-locked-notice-info')).not.toBeNull();
  expect(screen.queryByTestId('products-locked-notice-lock')).toBeNull();
  expect(classesOf('register-products')).toContain('opacity-40');
});

test('open: a tap adds and there is no notice', async () => {
  const app = await closedTill();
  await openRegister(app);
  dismissToast();
  fireEvent.click(screen.getByText('Espresso'));
  await waitFor(() => expect(espressoInCart()).toBe('1'));
  expect(refusals()).toEqual([]);
  expect(screen.queryByTestId('products-locked-notice')).toBeNull();
  expect(classesOf('register-products')).not.toContain('opacity-40');
});

test('sessions off: a tap adds and there is no notice', async () => {
  const app = await setup();
  expect(app.register.enabled).toBe(false);
  fireEvent.click(screen.getByText('Espresso'));
  await waitFor(() => expect(espressoInCart()).toBe('1'));
  expect(refusals()).toEqual([]);
  expect(screen.queryByTestId('products-locked-notice')).toBeNull();
});

test('a scan while closed adds nothing and is refused before the lookup', async () => {
  const app = await closedTill();
  const input = screen.getByPlaceholderText('Search products') as HTMLInputElement;
  dismissToast();
  fireEvent.change(input, { target: { value: '2000000000015' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  // No scan alert ("Couldn’t add to cart"): v2 refuses before the lookup and leaves the search as it was.
  expect(getToasts()).toEqual([expect.objectContaining(priceCheckToast)]);
  expect(input.value).toBe('2000000000015');
  await openRegister(app);
  expect(await screen.findByTestId('cart-empty')).not.toBeNull();
  expect(espressoInCart()).toBeNull();
});
