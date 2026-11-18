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

const wide = () => vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1280, height: 800, scale: 1, fontScale: 1 });

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

async function setup(onSignOut: () => void, cashiers: { uuid: string; name: string }[] = []) {
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
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={onSignOut}
            onSwitchCashier={async () => null} cashiers={cashiers} />
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  return { get register() { return register; }, get outbox() { return outbox; } };
}

const shell = () => screen.getByTestId('register-bar-shell');

async function openSessionThroughCard() {
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-empty');
}

test('register open: Sign out asks with the drawer figure, and Close register starts the count in the cart column', async () => {
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  const onSignOut = vi.fn();
  const app = await setup(onSignOut);
  await openSessionThroughCard();
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
  fireEvent.click(within(shell()).getByTestId('register-bar-avatar'));
  fireEvent.click(screen.getByTestId('user-sheet-sign-out'));
  expect(screen.getByText(`${app.register.registerName ?? 'This till'} is still open at $100.00. Close it first?`)).not.toBeNull();
  fireEvent.click(screen.getByTestId('sign-out-confirm-close-register'));
  await waitFor(() => expect(app.register.session?.status).toBe('counting'));
  expect(await screen.findByTestId('register-count')).not.toBeNull();
  expect(onSignOut).not.toHaveBeenCalled();
  expect(screen.queryByTestId('user-sheet')).toBeNull();
  expect(screen.queryByTestId('register-panel')).toBeNull();
}, 20_000);

test('register closed: Sign out signs out at once', async () => {
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  const onSignOut = vi.fn();
  await setup(onSignOut);
  await screen.findByTestId('open-register-card');
  fireEvent.click(within(shell()).getByTestId('register-bar-avatar'));
  fireEvent.click(screen.getByTestId('user-sheet-sign-out'));
  expect(onSignOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('sign-out-confirm')).toBeNull();
}, 20_000);

test('sessions off: Sign out signs out at once', async () => {
  sessionsOff();
  const onSignOut = vi.fn();
  await setup(onSignOut);
  fireEvent.click(within(shell()).getByTestId('register-bar-avatar'));
  fireEvent.click(screen.getByTestId('user-sheet-sign-out'));
  expect(onSignOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('sign-out-confirm')).toBeNull();
}, 20_000);

// v2 switch-confirm.tsx:136-137: the hand-over names the drawer only while the bound register has a session.
const SAM = [{ uuid: 'b', name: 'Sam' }];
function handOverDescription() {
  fireEvent.click(within(shell()).getByTestId('register-bar-avatar'));
  fireEvent.click(screen.getByTestId('user-sheet-user-b'));
  return within(screen.getByTestId('switch-confirm')).getByText(/^The POS reloads as Sam\./).textContent;
}

test('register open: the hand-over says the drawer stays open on the register', async () => {
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  const app = await setup(vi.fn(), SAM);
  await openSessionThroughCard();
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
  expect(handOverDescription()).toBe(`The POS reloads as Sam. The drawer stays open on ${app.register.registerName ?? 'This till'}.`);
}, 20_000);

test('register closed: the hand-over says nothing about the drawer', async () => {
  localStorage.setItem(REGISTER_SESSIONS_KEY, 'true');
  await setup(vi.fn(), SAM);
  await screen.findByTestId('open-register-card');
  expect(handOverDescription()).toBe('The POS reloads as Sam.');
}, 20_000);
