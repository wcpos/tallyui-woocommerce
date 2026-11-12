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
import { GeneralSettings } from '../components/settings/general-settings';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { REGISTER_SESSIONS_KEY } from '../lib/register/register-setting';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { memoryStorage } from './memory-storage';

// A fresh install: nothing saved but the session and the flat product grid these tests tap.
beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.clear();
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

/** The sale screen and Settings › General under the one RegisterProvider, as the root layout mounts them. */
async function setup({ withSettings = false } = {}) {
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
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
          {withSettings && <GeneralSettings store={{ id: 1, name: stores[0].name, currency: stores[0].currency }} siteHome="https://shop.example/" />}
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  return { get register() { return register; }, get outbox() { return outbox; } };
}

const settingsSwitch = () => within(screen.getByTestId('settings-general-register'))
  .getByRole('switch', { name: 'Use register sessions' });

test('a fresh install opens on the open-register card with a float to count, not the plain cart', async () => {
  const app = await setup();
  expect(localStorage.getItem(REGISTER_SESSIONS_KEY)).toBeNull();
  expect(app.register.setting).toBe(true);
  expect(await screen.findByTestId('open-register-card')).not.toBeNull();
  expect(screen.getByTestId('open-register-amount')).not.toBeNull();
  expect(screen.getByTestId('register-bar-pill').textContent).toBe('Register closed');
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  expect(app.register.session).toBeNull();
});

test('Settings › General shows the Register sessions switch while the register is closed', async () => {
  const app = await setup({ withSettings: true });
  await screen.findByTestId('open-register-card');
  expect(app.register.session).toBeNull();
  const group = within(screen.getByTestId('settings-general-register'));
  expect(group.getByText('Register sessions')).not.toBeNull();
  expect(settingsSwitch().getAttribute('aria-checked')).toBe('true');
});

test('turning sessions off in Settings › General returns the sale screen to the plain cart', async () => {
  const app = await setup({ withSettings: true });
  await screen.findByTestId('open-register-card');
  fireEvent.click(settingsSwitch());
  expect(app.register.setting).toBe(false);
  expect(localStorage.getItem(REGISTER_SESSIONS_KEY)).toBe('false');
  await waitFor(() => expect(screen.queryByTestId('open-register-card')).toBeNull());
  expect(screen.getByTestId('cart-empty')).not.toBeNull();
  expect(screen.queryByTestId('cart-checkout')).toBeNull();
  expect(screen.queryByTestId('register-bar-pill')).toBeNull();
  expect(settingsSwitch().getAttribute('aria-checked')).toBe('false');
});

test('the Settings switch stays while a session is open', async () => {
  const app = await setup({ withSettings: true });
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByTestId('cart-empty');
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
  expect(settingsSwitch().getAttribute('aria-checked')).toBe('true');
});
