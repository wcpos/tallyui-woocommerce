import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import { getBoundRegisterId, readRegister, RegisterTenderInProgressError, type CommandTransport } from '@tallyui/pos';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { RegisterProvider, useRegister } from '../lib/register/register-context';
import { useRegisterSessionsSetting } from '../lib/register/register-setting';
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
  expect(register.enabled).toBe(false);
  expect(register.session).toBeNull();
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

test('sessions default off: cash completes, stores and sends without a sessionId', async () => {
  const app = await setup();
  expect(app.register.setting).toBe(false);
  expect(app.register.enabled).toBe(false);
  await payCash();
  await waitFor(() => expect(app.send).toHaveBeenCalledTimes(1));
  const rows = await app.orders.find().exec();
  expect(rows).toHaveLength(1);
  expect(rows[0].toJSON()).not.toHaveProperty('sessionId');
  expect(app.send.mock.calls[0][0][0].payload).not.toHaveProperty('sessionId');
}, 20_000);

test('sessions on: Cash refuses without an open session and stays in the cart', async () => {
  const app = await setup();
  act(() => app.register.setSetting(true));
  expect(app.register.enabled).toBe(true);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(await screen.findByText('Open the register to take payment.')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Cash' })).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();
  expect(screen.queryByText('Cash Tendered')).toBeNull();
  expect(await app.orders.find().exec()).toEqual([]);
  expect(app.send).not.toHaveBeenCalled();
});

test('an opened session stamps the cash sale and envelope and still shows its receipt', async () => {
  const app = await setup();
  act(() => app.register.setSetting(true));
  await act(async () => { await app.register.actions.openSession({ expectedFloatMinor: 10000, countedFloatMinor: 10000 }); });
  await waitFor(() => expect(app.register.session?.status).toBe('open'));
  const sessionId = app.register.session!.id;
  expect(app.register.session).toMatchObject({ counted_float_minor: 10000, opened_by: '2', register_id: app.register.boundRegisterId });
  const doc = await readRegister(app.orders.database.collections.register_sessions);
  expect(app.register.boundRegisterId).toBe(doc!.id);
  expect(getBoundRegisterId(doc, app.orders.database.name)).toBe(doc!.id);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  const complete = await screen.findByRole('button', { name: 'Complete sale' });
  await expect(app.register.actions.startCounting()).rejects.toBeInstanceOf(RegisterTenderInProgressError);
  fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '10.00' } });
  fireEvent.click(complete);
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
  await waitFor(() => expect(app.send).toHaveBeenCalledTimes(1));
  const rows = await app.orders.find().exec();
  expect(rows).toHaveLength(1);
  expect(rows[0].toJSON()).toMatchObject({ sessionId, registerId: 'web' });
  expect(app.send.mock.calls[0][0]).toEqual([expect.objectContaining({ type: 'order.create', payload: expect.objectContaining({ sessionId }) })]);
}, 20_000);

test('the setting persists for a fresh hook', () => {
  const first = renderHook(useRegisterSessionsSetting);
  expect(first.result.current[0]).toBe(false);
  act(() => first.result.current[1](true));
  expect(localStorage.getItem('tallywoo.register_sessions')).toBe('true');
  first.unmount();
  const fresh = renderHook(useRegisterSessionsSetting);
  expect(fresh.result.current[0]).toBe(true);
  act(() => fresh.result.current[1](false));
  expect(localStorage.getItem('tallywoo.register_sessions')).toBe('false');
});

test.each(['missing', 'throwing'])('unavailable storage (%s) keeps sessions off on read and write', kind => {
  vi.stubGlobal('localStorage', kind === 'missing' ? undefined : {
    getItem: () => { throw new Error('unavailable'); },
    setItem: () => { throw new Error('unavailable'); },
  });
  const hook = renderHook(useRegisterSessionsSetting);
  expect(hook.result.current[0]).toBe(false);
  act(() => hook.result.current[1](true));
  expect(hook.result.current[0]).toBe(false);
});
