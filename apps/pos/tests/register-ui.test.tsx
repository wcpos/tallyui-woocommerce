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

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
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
          <SaleScreen connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
          <PortalHost />
        </RegisterProvider>
      </OutboxProvider>
    </SessionProvider>,
  );
  await waitFor(() => expect(register.boundRegisterId).not.toBeNull());
  if (!outbox.enabled || !outbox.orders) throw new Error('Order store not ready');
  return { get register() { return register; }, orders: outbox.orders, send };
}

async function payCash() {
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  const complete = await screen.findByRole('button', { name: 'Complete sale' });
  fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '10.00' } });
  fireEvent.click(complete);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}

test('sessions default off: no register UI and the cart completes a cash sale', async () => {
  const app = await setup();
  expect(screen.getByRole('switch', { name: 'Use register sessions' }).getAttribute('aria-checked')).toBe('false');
  expect(screen.queryByTestId('register-bar')).toBeNull();
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
    fireEvent.click(screen.getByRole('button', { name: /Open cart/ }));
  }
  const toggle = screen.getByRole('switch', { name: 'Use register sessions' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-checked')).toBe('true');
  expect(app.register.setting).toBe(true);
  expect(screen.getByText('A session starts with a counted float, records cash paid in and out, and closes with a count that shows any difference.')).not.toBeNull();
  expect(await screen.findByTestId('open-register-card')).not.toBeNull();
  expect(screen.getByTestId('register-bar')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Cash' })).toBeNull();
});

test('open, pay out, sell, count and close, then reuse the counted float', async () => {
  await setup();
  fireEvent.click(screen.getByRole('switch', { name: 'Use register sessions' }));
  fireEvent.change(await screen.findByTestId('open-register-amount'), { target: { value: '100.00' } });
  fireEvent.click(screen.getByTestId('open-register-button'));
  await screen.findByRole('button', { name: 'Cash' });
  fireEvent.click(screen.getByTestId('register-bar-open-panel'));
  fireEvent.click(await screen.findByTestId('register-panel-paid-out'));
  fireEvent.change(await screen.findByTestId('movement-amount'), { target: { value: '20.00' } });
  fireEvent.change(screen.getByTestId('movement-reason'), { target: { value: 'Milk' } });
  fireEvent.click(screen.getByTestId('movement-confirm'));
  await waitFor(() => expect(within(screen.getByTestId('register-panel-expected')).getByText('$80.00')).not.toBeNull());
  await waitFor(() => expect(screen.queryByTestId('movement-confirm')).toBeNull());
  fireEvent.click(screen.getByTestId('register-panel-dismiss'));
  await payCash();
  fireEvent.click(screen.getByTestId('register-bar-open-panel'));
  await waitFor(() => expect(screen.getByTestId('register-panel-sales-count').textContent).toBe('1 sale this session'));
  expect(within(screen.getByTestId('register-panel-expected')).getByText('$83.00')).not.toBeNull();
  fireEvent.click(screen.getByTestId('register-panel-close'));
  fireEvent.change(await screen.findByTestId('count-amount'), { target: { value: '83.00' } });
  expect(screen.queryByRole('button', { name: 'Cash' })).toBeNull();
  fireEvent.click(screen.getByTestId('count-close'));
  expect((await screen.findByTestId('closure-number')).textContent).toBe('Closure #1');
  expect(screen.getByTestId('closure-counted-cash').textContent).toBe('Counted $83.00');
  expect(screen.getByTestId('closure-expected-cash').textContent).toBe('Expected $83.00');
  expect(screen.getByTestId('closure-variance-cash').textContent).toBe('Exact');
  expect(screen.queryByTestId('closure-print')).toBeNull();
  fireEvent.click(screen.getByTestId('closure-done'));
  await waitFor(() => expect(screen.queryByTestId('closure-sheet')).toBeNull());
  expect(screen.getByTestId('open-register-card')).not.toBeNull();
  expect((screen.getByTestId('open-register-amount') as HTMLInputElement).value).toBe('83.00');
}, 20_000);

test('switching sessions off removes the register UI and allows a sale without a session', async () => {
  const app = await setup();
  const toggle = screen.getByRole('switch', { name: 'Use register sessions' });
  fireEvent.click(toggle);
  expect(await screen.findByTestId('open-register-card')).not.toBeNull();
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-checked')).toBe('false');
  expect(app.register.session).toBeNull();
  expect(screen.queryByTestId('register-bar')).toBeNull();
  expect(screen.queryByTestId('open-register-card')).toBeNull();
  expect(screen.queryByTestId('register-panel')).toBeNull();
  expect(screen.queryByTestId('register-count')).toBeNull();
  expect(screen.queryByTestId('closure-sheet')).toBeNull();
  await payCash();
  await waitFor(() => expect(app.send).toHaveBeenCalledTimes(1));
  expect((await app.orders.find().exec())[0].toJSON()).not.toHaveProperty('sessionId');
}, 20_000);
