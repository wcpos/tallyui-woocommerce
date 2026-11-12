import { noTaxSettings } from './fixtures/store-settings';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { sessionsOff } from './cart-head-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { REGISTER_SESSIONS_KEY } from '../lib/register/register-setting';
import { cartPane, openCartTab, openProductsTab, paneShown, productsPane } from './phone-tabs-helpers';
import { classesOf } from './classes-of';

// DEMO-PARITY A3. v2 draws its RegisterBar as the cart column's first row (packages/core/src/screens/main/pos/cart/
// index.tsx:189), with no register button: the avatar's sheet is the one door to the register panel (cart/
// register-bar.tsx:47-50). On a phone the bar shows on both tabs (apps/main/components/pos-products-pane.tsx:17 and
// the Cart tab's cart column).

const wide = () => vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });
const phone = () => vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });

beforeEach(() => {
  wide();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  sessionsOff();
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
  return { get register() { return register; }, get outbox() { return outbox; } };
}

const shell = () => screen.getByTestId('register-bar-shell');
const follows = (first: Node, second: Node) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

async function openSessionThroughCard() {
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-empty');
}

test('wide: the bar is the cart column\'s first row, and the catalogue column starts with its search row', async () => {
  await setup();
  const cartPanel = screen.getByTestId('pos-cart-panel');
  const productsPanel = screen.getByTestId('pos-products-panel');
  expect(screen.getAllByTestId('register-bar-shell')).toHaveLength(1);
  expect(shell().closest('[data-testid="pos-cart-panel"]')).toBe(cartPanel);
  expect(within(productsPanel).queryByTestId('register-bar-shell')).toBeNull();
  expect(within(productsPanel).queryByTestId('pos-drawer-open-button')).toBeNull();
  // The bar keeps its parts and sits above the cart's own head.
  for (const id of ['register-bar-place', 'register-bar-bell', 'register-bar-avatar', 'pos-drawer-open-button']) {
    expect(within(shell()).getByTestId(id)).not.toBeNull();
  }
  expect(cartPanel.firstElementChild).toBe(shell());
  expect(follows(shell(), within(cartPanel).getByTestId('cart-settings-button'))).toBe(true);
  expect(within(productsPanel).getByText('Espresso')).not.toBeNull();
}, 20_000);

// P11-S2: v2's cart column paints its own white surface (cart/index.tsx:75,187) with its rows 8 px in (cart/foot.tsx:35),
// a 20 px cashier avatar (avatar/index.tsx:42,58) and 44 px cart controls (icon-button/index.tsx:26).
test('wide: the cart column is a card-coloured pane 8 px in, with a 20 px avatar and 44 px controls', async () => {
  await setup();
  expect(classesOf('pos-cart-panel')).toContain('bg-card');
  const pane = classesOf('cart-pane');
  expect(pane).toEqual(expect.arrayContaining(['bg-card', 'p-2']));
  expect(pane).not.toContain('p-4');
  expect(pane).not.toContain('bg-background');
  expect(classesOf('register-bar-avatar-initials')).toContain('size-5');
  expect(classesOf('register-bar-avatar-initials')).not.toContain('size-7');
  for (const id of ['cart-add-menu', 'cart-settings-button']) {
    expect(classesOf(id)).toEqual(expect.arrayContaining(['h-11', 'w-11']));
  }
}, 20_000);

test('wide, with the cart on the left: the bar still heads the cart column', async () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all', position: 'right' }));
  await setup();
  const cartPanel = screen.getByTestId('pos-cart-panel');
  const productsPanel = screen.getByTestId('pos-products-panel');
  // The swap took: the cart column comes first.
  expect(follows(cartPanel, productsPanel)).toBe(true);
  expect(shell().closest('[data-testid="pos-cart-panel"]')).toBe(cartPanel);
  expect(cartPanel.firstElementChild).toBe(shell());
  expect(within(productsPanel).queryByTestId('register-bar-shell')).toBeNull();
}, 20_000);

test('register closed: the bar\'s own pill shows the state, and the cart has no second register row', async () => {
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  await setup();
  expect(await screen.findByTestId('open-register-card')).not.toBeNull();
  expect(within(shell()).getByTestId('register-bar-pill').textContent).toBe('Register closed');
  expect(screen.getAllByTestId('register-bar-pill')).toHaveLength(1);
  expect(screen.getAllByText('Register closed')).toHaveLength(1);
  expect(screen.queryByTestId('register-bar')).toBeNull();
  expect(screen.queryByTestId('register-bar-open-panel')).toBeNull();
}, 20_000);

test('register open: no "Register ›" row, and the avatar\'s drawer door opens the register panel', async () => {
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  const app = await setup();
  await openSessionThroughCard();
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
  expect(screen.queryByTestId('register-bar')).toBeNull();
  expect(screen.queryByTestId('register-bar-open-panel')).toBeNull();
  expect(screen.queryByText('Register ›')).toBeNull();
  expect(screen.queryByTestId('register-panel')).toBeNull();
  fireEvent.click(within(shell()).getByTestId('register-bar-avatar'));
  fireEvent.click(await screen.findByTestId('user-sheet-drawer'));
  expect(await screen.findByTestId('register-panel')).not.toBeNull();
  expect(screen.getByTestId('register-panel-paid-out')).not.toBeNull();
}, 20_000);

test('phone: one bar over both tabs, outside either pane, as v2 draws it on the Products tab and the Cart tab', async () => {
  phone();
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  await setup();
  await screen.findByTestId('open-register-card');
  const products = screen.getByTestId('pos-pane-products');
  expect(screen.getAllByTestId('register-bar-shell')).toHaveLength(1);
  expect(productsPane().queryByTestId('register-bar-shell')).toBeNull();
  expect(cartPane().queryByTestId('register-bar-shell')).toBeNull();
  expect(follows(shell(), products)).toBe(true);
  expect(paneShown('products')).toBe(true);
  expect(within(shell()).getByTestId('register-bar-pill').textContent).toBe('Register closed');
  openCartTab();
  expect(paneShown('cart')).toBe(true);
  // On the Cart tab the bar is still the one pill, with no register row of the cart's own under it.
  expect(screen.getAllByTestId('register-bar-pill')).toHaveLength(1);
  expect(cartPane().queryByTestId('register-bar')).toBeNull();
  openProductsTab();
  expect(screen.getAllByTestId('register-bar-shell')).toHaveLength(1);
}, 20_000);
