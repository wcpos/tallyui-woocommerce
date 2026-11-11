import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

function SaleScreen(props: ComponentProps<typeof SaleScreenWithoutHost>) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

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

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test('cash tender records and sends one sale, prints a final receipt, and starts an empty sale', async () => {
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
    kind: 'results',
    results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })),
  }));
  const fakeTransport = { send };
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => fakeTransport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  // A1: v2 draws nothing under the open-order strip while sales are up to date.
  expect(screen.queryByText('Sales are up to date.')).toBeNull();
  expect(screen.queryByTestId('sync-status')).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(screen.getByTestId('checkout-keypad')).not.toBeNull();
  expect(screen.queryByText('Taking payment arrives in the next update')).toBeNull();
  await takeCash(1000);
  const receiptOrder = await screen.findByTestId('receipt-order');
  const receipt = within(receiptOrder.parentElement!);
  expect(receipt.getByText(stores[0].name)).not.toBeNull();
  expect(receipt.getByLabelText('Total: $6.00')).not.toBeNull();
  const identity = within(screen.getByTestId('receipt-identity'));
  expect(identity.getByText('Sales receipt')).not.toBeNull();
  expect(identity.getByText('Register: This till')).not.toBeNull();
  expect(identity.getByText('TallyUI WooCommerce POS 0.1.0')).not.toBeNull();
  expect(screen.queryByTestId('receipt-copy')).toBeNull();
  // The print counter listens for afterprint from a passive effect, which can run after the receipt is visible; the
  // print sheet's style is installed in the same commit's effects, so once it is in the head the counter listens.
  await waitFor(() => expect(document.head.querySelector('style[data-receipt-print]')).not.toBeNull());
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(screen.getByTestId('receipt-copy').textContent).toBe('COPY 1');
  act(() => { window.dispatchEvent(new Event('afterprint')); });
  expect(screen.getByTestId('receipt-copy').textContent).toBe('COPY 2');
  expect(receipt.queryByText(/\(draft\)/)).toBeNull();
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send.mock.calls.flatMap(([batch]) => batch)).toEqual([expect.objectContaining({ type: 'order.create' })]);
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(screen.queryByText('Sales are up to date.')).toBeNull();
  fireEvent.click(receipt.getByRole('button', { name: 'New sale' }));
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(screen.queryByTestId('receipt-identity')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
  expect(send).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(1000);
  await screen.findByTestId('receipt-order');
  expect(screen.queryByTestId('receipt-copy')).toBeNull();
}, 20_000);

// A1: while a sale waits, retries or was refused, the line under the strip is TallyUI's SyncStatus, in its own words.
function renderWithTransport(send: CommandTransport<OrderCreateEnvelope>['send']) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => ({ send })} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
      </OutboxProvider>
    </SessionProvider>,
  );
}

test('a sale the store has not taken yet shows the sync line: waiting, then retrying', async () => {
  renderWithTransport(async () => ({ kind: 'retry', reason: 'network' }));
  await screen.findByText('Order store ready');
  expect(screen.queryByTestId('sync-status')).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
  await screen.findByTestId('receipt-order');
  const line = await screen.findByTestId('sync-status');
  await waitFor(() => expect(within(line).getByText('1 sale waiting to sync')).not.toBeNull());
  await waitFor(() => expect(within(line).getByText(/^Retrying in \d+ s\.$/)).not.toBeNull());
  expect(screen.queryByText('Sales are up to date.')).toBeNull();
}, 20_000);

test('a sale the store refused shows the sync line with SyncStatus\'s refusal', async () => {
  renderWithTransport(async batch => ({ kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'rejected',
    error: { code: 'store_configuration', message: 'A store setting needs changing.' } })) }));
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(300);
  await screen.findByTestId('receipt-order');
  const line = await screen.findByTestId('sync-status');
  await waitFor(() => expect(within(line).getByText(/^1 sale needs attention · The online store refused it\./)).not.toBeNull());
  expect(screen.queryByText('Sales are up to date.')).toBeNull();
}, 20_000);
