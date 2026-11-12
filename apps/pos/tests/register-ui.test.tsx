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
import { OnlineStatusContext, type OnlineStatus } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { sessionsOff, toggleRegisterSessions } from './cart-head-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { REGISTER_SESSIONS_KEY } from '../lib/register/register-setting';
import { cartPane, openCartTab, openProductsTab } from './phone-tabs-helpers';

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
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function setup(online?: OnlineStatus) {
  let register!: ReturnType<typeof useRegister>;
  let outbox!: ReturnType<typeof useOutbox>;
  function Probe() { register = useRegister(); outbox = useOutbox(); return null; }
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  const tree = (
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
    </SessionProvider>
  );
  render(online ? <OnlineStatusContext.Provider value={{ status: online }}>{tree}</OnlineStatusContext.Provider> : tree);
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  if (!outbox.enabled || !outbox.orders) throw new Error('Order store not ready');
  return { get register() { return register; }, orders: outbox.orders, send };
}

/** v2's one door to the register panel: the bar's avatar opens the cashier sheet, whose drawer figure opens the panel. */
async function openRegisterPanel() {
  fireEvent.click(within(screen.getByTestId('register-bar-shell')).getByTestId('register-bar-avatar'));
  fireEvent.click(await screen.findByTestId('user-sheet-drawer'));
}

async function payCash() {
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(1000);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}

test.each([900, 390])('Offline shows once, in the bar\'s own pill, with sessions off and on at width %s', async width => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  await setup('online-website-unavailable');
  expect(screen.getByTestId('register-bar-pill').textContent).toBe('Offline');
  if (width < 900) {
    fireEvent.click(screen.getByText('Espresso'));
    openCartTab();
  }
  toggleRegisterSessions();
  await screen.findByTestId('open-register-card');
  // One pill in the window, the bar's: the cart draws no register row of its own.
  expect(screen.getAllByTestId('register-bar-pill').map(pill => pill.textContent)).toEqual(['Offline']);
  expect(within(screen.getByTestId('register-bar-shell')).getByTestId('register-bar-pill')).not.toBeNull();
  if (width < 900) {
    openProductsTab();
    expect(screen.getAllByTestId('register-bar-pill').map(pill => pill.textContent)).toEqual(['Offline']);
  }
});

test('sessions saved off: no register UI and the cart completes a cash sale', async () => {
  const app = await setup();
  // The switch sits in Cart Settings, not under the cart.
  expect(screen.queryByRole('switch', { name: 'Use register sessions' })).toBeNull();
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  expect(within(screen.getByTestId('cart-settings')).getByRole('switch', { name: 'Use register sessions' })
    .getAttribute('aria-checked')).toBe('false');
  fireEvent.click(screen.getByTestId('ui-settings-close'));
  expect(screen.queryByTestId('register-bar-pill')).toBeNull();
  expect(screen.queryByTestId('open-register-card')).toBeNull();
  await payCash();
  await waitFor(() => expect(app.send).toHaveBeenCalledTimes(1));
  expect((await app.orders.find().exec())[0].toJSON()).not.toHaveProperty('sessionId');
}, 20_000);

test.each([900, 390])('the switch enables the register and replaces the cart at width %s', async width => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  const app = await setup();
  if (width < 900) {
    fireEvent.click(screen.getByText('Espresso'));
    openCartTab();
  }
  fireEvent.click(screen.getByTestId('cart-settings-button'));
  const settings = within(screen.getByTestId('cart-settings'));
  expect(settings.getByText('Register sessions')).not.toBeNull();
  expect(settings.getByText('A session starts with a counted float, records cash paid in and out, and closes with a count that shows any difference.')).not.toBeNull();
  const toggle = settings.getByRole('switch', { name: 'Use register sessions' });
  fireEvent.click(toggle);
  expect(app.register.setting).toBe(true);
  expect(await screen.findByTestId('open-register-card')).not.toBeNull();
  expect(within(screen.getByTestId('register-bar-shell')).getByTestId('register-bar-pill').textContent).toBe('Register closed');
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
});

test('open, pay out, sell, count and close, then reuse the counted float', async () => {
  await setup();
  toggleRegisterSessions();
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-empty');
  await openRegisterPanel();
  fireEvent.click(await screen.findByTestId('register-panel-paid-out'));
  fireEvent.change(await screen.findByTestId('movement-amount'), { target: { value: '20.00' } });
  fireEvent.change(screen.getByTestId('movement-reason'), { target: { value: 'Milk' } });
  fireEvent.click(screen.getByTestId('movement-confirm'));
  await waitFor(() => expect(within(screen.getByTestId('register-panel-expected')).getByText('$80.00')).not.toBeNull());
  await waitFor(() => expect(screen.queryByTestId('movement-confirm')).toBeNull());
  fireEvent.click(screen.getByTestId('register-panel-dismiss'));
  await payCash();
  await openRegisterPanel();
  await waitFor(() => expect(screen.getByTestId('register-panel-sales-count').textContent).toBe('1 sale this session'));
  expect(within(screen.getByTestId('register-panel-expected')).getByText('$83.00')).not.toBeNull();
  fireEvent.click(screen.getByTestId('register-panel-close'));
  fireEvent.change(await screen.findByTestId('count-amount'), { target: { value: '83.00' } });
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  fireEvent.click(screen.getByTestId('count-close'));
  expect((await screen.findByTestId('closure-number')).textContent).toBe('Closure #1');
  expect(screen.getByTestId('closure-counted-cash').textContent).toBe('Counted $83.00');
  expect(screen.getByTestId('closure-expected-cash').textContent).toBe('Expected $83.00');
  expect(screen.getByTestId('closure-variance-cash').textContent).toBe('Exact');
  expect(screen.getByTestId('closure-print')).not.toBeNull();
  fireEvent.click(screen.getByTestId('closure-done'));
  await waitFor(() => expect(screen.queryByTestId('closure-sheet')).toBeNull());
  expect(screen.getByTestId('open-register-card')).not.toBeNull();
  expect((screen.getByTestId('open-register-amount') as HTMLInputElement).value).toBe('83.00');
}, 20_000);

test('switching sessions off removes the register UI and allows a sale without a session', async () => {
  const app = await setup();
  toggleRegisterSessions();
  expect(await screen.findByTestId('open-register-card')).not.toBeNull();
  // The open-register card replaces the cart and its head, so Cart Settings is reached again once a session is open.
  expect(screen.queryByTestId('cart-settings-button')).toBeNull();
  fireEvent.change(screen.getByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-empty');
  toggleRegisterSessions();
  expect(app.register.setting).toBe(false);
  await waitFor(() => expect(app.register.session).toBeNull());
  expect(screen.queryByTestId('register-bar-pill')).toBeNull();
  expect(screen.queryByTestId('open-register-card')).toBeNull();
  expect(screen.queryByTestId('register-panel')).toBeNull();
  expect(screen.queryByTestId('register-count')).toBeNull();
  expect(screen.queryByTestId('closure-sheet')).toBeNull();
  await payCash();
  await waitFor(() => expect(app.send).toHaveBeenCalledTimes(1));
  expect((await app.orders.find().exec())[0].toJSON()).not.toHaveProperty('sessionId');
}, 20_000);

test('phone (B12): with sessions on and the register open, the Cart tab has one menu button and one bar, with no register row under it', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  await setup();
  openCartTab();
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-empty');
  expect(screen.getAllByTestId('pos-drawer-open-button')).toHaveLength(1);
  expect(screen.getAllByTestId('register-bar-shell')).toHaveLength(1);
  expect(cartPane().queryByTestId('register-bar')).toBeNull();
  expect(screen.queryByText('Register ›')).toBeNull();
  await openRegisterPanel();
  expect(await screen.findByTestId('register-panel')).not.toBeNull();
}, 20_000);
