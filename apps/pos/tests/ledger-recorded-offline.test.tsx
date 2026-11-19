import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
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
import { useOfflineLegs } from '../lib/sale/offline-legs';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

// WCPOS v2: ledger-pane.tsx:287-293 (row.recorded_offline), core.json pos_checkout.recorded_offline.
const RECORDED_OFFLINE = 'Recorded offline';

beforeEach(() => {
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
function StatusHost({ initial, children }: { initial: OnlineStatus; children: ReactNode }) {
  const [status, set] = useState(initial);
  setStatus = set;
  return <OnlineStatusContext.Provider value={{ status }}>{children}</OnlineStatusContext.Provider>;
}

/** A split checkout of one Espresso ($3.00) at the given width, under the given online status. */
async function startSplit({ status, width = 1280 }: { status: OnlineStatus; width?: number }) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 844, scale: 1, fontScale: 1 });
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })),
  }));
  render(
    <StatusHost initial={status}>
      <SessionProvider>
        <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
          <OrderStoreReady />
          <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
            storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
            multiplePayments />
          <PortalHost />
        </OutboxProvider>
      </SessionProvider>
    </StatusHost>,
  );
  await screen.findByText('Order store ready');
  await checkout();
  return send;
}

async function checkout() {
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await screen.findByTestId('checkout-keypad');
}

const legs = () => within(screen.getByTestId('checkout-ledger')).queryAllByTestId(/^checkout-leg-/);
const offlineLines = () => screen.queryAllByTestId(/^checkout-offline-leg-/);
const legId = (leg: HTMLElement) => leg.getAttribute('data-testid')!.replace('checkout-leg-', '');

/** Takes one cash leg of `minor`; offline, it answers the offline question with Confirm. */
async function takeLeg(minor: number, offline: boolean) {
  const before = legs().length;
  fireEvent.click(screen.getByTestId('checkout-keypad-key-clear'));
  for (const digit of String(minor)) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${digit}`));
  fireEvent.click(screen.getByTestId('checkout-commit'));
  if (offline) fireEvent.click(await screen.findByTestId('checkout-offline-confirm'));
  else expect(screen.queryByTestId('checkout-offline-dialog')).toBeNull();
  await waitFor(() => expect(legs()).toHaveLength(before + 1));
  return legs()[before]!;
}

test.each([
  { scenario: 'the wide ledger pane', width: 1280, pane: 'checkout-ledger-column' },
  { scenario: 'the phone ledger under the tender', width: 390, pane: 'checkout-scroll' },
])('a leg taken offline and confirmed shows "Recorded offline" under it: $scenario', async ({ width, pane }) => {
  await startSplit({ status: 'offline', width });
  const leg = await takeLeg(100, true);
  const id = legId(leg);
  const line = within(leg).getByTestId(`checkout-offline-leg-${id}`);
  expect(line.textContent).toBe(RECORDED_OFFLINE);
  expect(within(screen.getByTestId(pane)).getByTestId(`checkout-offline-leg-${id}`)).toBe(line);
  expect(offlineLines()).toHaveLength(1);
}, 20_000);

test('a leg taken online shows no line, also after an offline leg in the same sale', async () => {
  await startSplit({ status: 'offline' });
  const first = await takeLeg(100, true);
  act(() => setStatus('online-website-available'));
  const second = await takeLeg(100, false);
  expect(within(first).getByTestId(`checkout-offline-leg-${legId(first)}`).textContent).toBe(RECORDED_OFFLINE);
  expect(within(second).queryByTestId(/^checkout-offline-leg-/)).toBeNull();
  expect(second.textContent).not.toContain(RECORDED_OFFLINE);
  expect(offlineLines()).toHaveLength(1);
}, 20_000);

test('a new sale starts with no leg marked, after the sale completes', async () => {
  const send = await startSplit({ status: 'offline' });
  await takeLeg(100, true);
  act(() => setStatus('online-website-available'));
  await takeLeg(100, false);
  // The paying leg completes the sale.
  fireEvent.click(screen.getByTestId('checkout-keypad-key-clear'));
  for (const digit of '100') fireEvent.click(screen.getByTestId(`checkout-keypad-key-${digit}`));
  fireEvent.click(screen.getByTestId('checkout-commit'));
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'New sale' }));
  await checkout();
  await takeLeg(100, false);
  expect(offlineLines()).toHaveLength(0);
  expect(screen.queryByText(RECORDED_OFFLINE)).toBeNull();
}, 20_000);

test('a new sale starts with no leg marked: the mark is keyed by the order', () => {
  const { result, rerender } = renderHook(({ orderId }) => useOfflineLegs(orderId), { initialProps: { orderId: 'o1' } });
  act(() => result.current.mark('a'));
  expect([...result.current.ids]).toEqual(['a']);
  rerender({ orderId: 'o2' });
  expect(result.current.ids.has('a')).toBe(false);
  expect(result.current.ids.size).toBe(0);
  act(() => result.current.mark('b'));
  expect([...result.current.ids]).toEqual(['b']);
});

test('removing the offline leg removes its line; the other leg is unaffected', async () => {
  await startSplit({ status: 'offline' });
  const offlineLeg = await takeLeg(100, true);
  const offlineId = legId(offlineLeg);
  act(() => setStatus('online-website-available'));
  const onlineLeg = await takeLeg(100, false);
  const onlineId = legId(onlineLeg);
  fireEvent.click(screen.getByTestId(`checkout-remove-leg-${offlineId}`));
  await waitFor(() => expect(legs()).toHaveLength(1));
  expect(screen.queryByTestId(`checkout-offline-leg-${offlineId}`)).toBeNull();
  expect(offlineLines()).toHaveLength(0);
  expect(legs()[0]!.getAttribute('data-testid')).toBe(`checkout-leg-${onlineId}`);
  expect(legs()[0]!.textContent).toContain('$1.00');
}, 20_000);
