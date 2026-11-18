import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
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
import { OnlineStatusContext, type OnlineStatus } from '../lib/online/online-status';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

// WCPOS v2: core.json pos_checkout.confirm_offline_body.
const BODY = 'The sale is held on this device and sent when the store is back. If the store refuses it, the sale appears under Needs attention in Orders.';

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
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

let setStatus: (status: OnlineStatus) => void = () => {};
/** The online status as state, so a test can flip it while the question is open. */
function StatusHost({ initial, children }: { initial: OnlineStatus; children: ReactNode }) {
  const [status, set] = useState(initial);
  setStatus = set;
  return <OnlineStatusContext.Provider value={{ status }}>{children}</OnlineStatusContext.Provider>;
}

/** One Espresso ($3.00) in the cart, the checkout open on Cash (or Card), under the given online status. */
async function startTender({ status, multi = false, card = false, hold }: { status: OnlineStatus; multi?: boolean; card?: boolean; hold?: Promise<unknown> }) {
  // `hold` keeps the send pending, so a test can press again before the order settles.
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => {
    await hold;
    return {
      kind: 'results',
      results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
    };
  });
  const fakeTransport = { send };
  render(
    <StatusHost initial={status}>
      <SessionProvider>
        <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
          <OrderStoreReady />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            multiplePayments={multi} />
          <PortalHost />
        </OutboxProvider>
      </SessionProvider>
    </StatusHost>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await screen.findByTestId('checkout-keypad');
  if (card) fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  return send;
}

const press = (...keys: string[]) => { for (const key of keys) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${key}`)); };
const commit = () => fireEvent.click(screen.getByTestId('checkout-commit'));
const dialog = () => screen.getByTestId('checkout-offline-dialog');
const legs = () => within(screen.getByTestId('checkout-ledger')).queryAllByTestId(/^checkout-leg-/);
const tick = () => new Promise(resolve => setTimeout(resolve, 50));

async function sentPayments(send: Awaited<ReturnType<typeof startTender>>) {
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(1);
  return envelopes[0].payload.payments;
}

test('offline cash: the question names the applied amount, and nothing is recorded before Confirm', async () => {
  const send = await startTender({ status: 'offline' });
  press('clear', '1', '0', '0', '0');
  commit();
  expect(within(dialog()).getByRole('heading').textContent).toBe('Take $3.00 in Cash while offline?');
  expect(within(dialog()).getByText(BODY)).not.toBeNull();
  expect(screen.getByTestId('checkout-offline-cancel').textContent).toBe('Cancel');
  expect(screen.getByTestId('checkout-offline-confirm').textContent).toBe('Take $3.00 in Cash');
  await tick();
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  fireEvent.click(screen.getByTestId('checkout-offline-confirm'));
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 1000, changeMinor: 700 })]);
}, 20_000);

test('offline multi-leg: one leg asks with that leg\'s amount and Confirm records exactly one leg', async () => {
  await startTender({ status: 'offline', multi: true });
  press('clear', '1', '0', '0');
  commit();
  expect(within(dialog()).getByRole('heading').textContent).toBe('Take $1.00 in Cash while offline?');
  expect(legs()).toHaveLength(0);
  fireEvent.click(screen.getByTestId('checkout-offline-confirm'));
  await waitFor(() => expect(legs()).toHaveLength(1));
  expect(legs()[0].textContent).toContain('Cash');
  expect(legs()[0].textContent).toContain('$1.00');
  expect(screen.queryByTestId('checkout-offline-dialog')).toBeNull();
}, 20_000);

test('Cancel records nothing, keeps the entry, and a later take asks again', async () => {
  const send = await startTender({ status: 'offline' });
  press('clear', '1', '0', '0', '0');
  commit();
  fireEvent.click(screen.getByTestId('checkout-offline-cancel'));
  expect(screen.queryByTestId('checkout-offline-dialog')).toBeNull();
  await tick();
  expect(send).not.toHaveBeenCalled();
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(screen.getByTestId('checkout-tendered-line').textContent).toBe('Tendered $10.00');
  commit();
  expect(dialog()).not.toBeNull();
}, 20_000);

test('a second press while the question is open records nothing and opens no second dialog', async () => {
  const send = await startTender({ status: 'offline', multi: true });
  press('clear', '1', '0', '0');
  commit();
  // The store comes back while the question is open: the held gate, not the status, refuses the second press.
  act(() => setStatus('online-website-available'));
  commit();
  expect(screen.getAllByTestId('checkout-offline-dialog')).toHaveLength(1);
  await tick();
  expect(legs()).toHaveLength(0);
  expect(send).not.toHaveBeenCalled();
}, 20_000);

test('online: take records at once with no question', async () => {
  const send = await startTender({ status: 'online-website-available' });
  commit();
  expect(screen.queryByTestId('checkout-offline-dialog')).toBeNull();
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300 })]);
  expect(screen.queryByTestId('checkout-offline-dialog')).toBeNull();
}, 20_000);

test('a store that cannot be reached asks too', async () => {
  await startTender({ status: 'online-website-unavailable', card: true });
  commit();
  expect(within(dialog()).getByRole('heading').textContent).toBe('Take $3.00 in Card while offline?');
}, 20_000);

/** A promise the test resolves itself: the store's answer to the held send. */
function held() {
  let release: () => void = () => {};
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

// Desk review of #391: the Action also closes the dialog (onOpenChange(false) → cancelOffline). The primitive runs
// that close before onPress (confirmOffline), so the close can never release the gate after take() has started.
test('offline single mode: a second Take while the confirmed take is in flight records exactly one order', async () => {
  const store = held();
  const send = await startTender({ status: 'offline', hold: store.promise });
  press('clear', '1', '0', '0', '0');
  commit();
  fireEvent.click(screen.getByTestId('checkout-offline-confirm'));
  // Still saving: the take has not settled.
  expect(screen.getByTestId('checkout-commit').textContent).toBe('Saving order…');
  commit();
  expect(screen.queryAllByTestId('checkout-offline-dialog')).toHaveLength(0);
  store.release();
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300, tenderedMinor: 1000 })]);
  await tick();
  expect(send.mock.calls.flatMap(([batch]) => batch)).toHaveLength(1);
  expect(screen.queryAllByTestId('checkout-offline-dialog')).toHaveLength(0);
}, 20_000);

test('offline multi mode: a second Take while the confirmed leg is in flight records exactly one leg', async () => {
  const store = held();
  const send = await startTender({ status: 'offline', multi: true, hold: store.promise });
  press('clear', '3', '0', '0');
  commit();
  // A second tap before the leg renders: the confirm and the press land in one batch, with the pre-confirm handlers.
  act(() => {
    screen.getByTestId('checkout-offline-confirm').click();
    screen.getByTestId('checkout-commit').click();
  });
  expect(screen.queryAllByTestId('checkout-offline-dialog')).toHaveLength(0);
  expect(legs()).toHaveLength(1);
  // And again while the sale is saving.
  commit();
  expect(screen.queryAllByTestId('checkout-offline-dialog')).toHaveLength(0);
  store.release();
  expect(await sentPayments(send)).toEqual([expect.objectContaining({ method: 'cash', amountMinor: 300 })]);
  await tick();
  expect(send.mock.calls.flatMap(([batch]) => batch)).toHaveLength(1);
  expect(screen.queryAllByTestId('checkout-offline-dialog')).toHaveLength(0);
}, 20_000);
