import { noTaxSettings } from './fixtures/store-settings';
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
import { RECEIPT_SETTINGS_KEY } from '../lib/receipts/receipt-settings';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeLeg } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

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
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

// The store holds its answer until the test releases it, so the receipt first shows a sale the store has not heard.
function gatedTransport() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => {
    await gate;
    return { kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 600 } })) };
  });
  return { transport: { send }, release };
}

// split-tender.test.tsx: a $6.00 sale paid on the ledger as a cash leg of 200 and a card leg of 400, the last leg completing it.
async function paySplit(transport: { send: CommandTransport<OrderCreateEnvelope>['send'] }, untilReceipt = true) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => transport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  takeLeg(200);
  expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe('$4.00');
  takeLeg(400, 'pos_card');
  if (untilReceipt) await screen.findByTestId('receipt-order');
}

test('with auto print on, a split sale prints once, waits on the store, and Close starts a new sale', async () => {
  localStorage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":true}');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const { transport, release } = gatedTransport();
  await paySplit(transport);
  expect(screen.getByTestId('checkout-paid-headline').textContent).toContain('Paid $6.00');
  expect(screen.getByTestId('receipt-paid-with').textContent).toBe('Awaiting store · Cash + Card terminal · 2 payments');
  await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Print receipt · New sale' })).not.toBeNull();
  release();
  await waitFor(() => {
    expect(screen.queryByTestId('receipt-awaiting-store')).toBeNull();
    expect(screen.getByTestId('receipt-paid-disc').getAttribute('data-tone')).toBe('ok');
  });
  expect(print).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByTestId('receipt-close'));
  expect(await screen.findByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(screen.queryByTestId('receipt-order')).toBeNull();
}, 20_000);

test('with auto print off, the receipt keeps New sale and never prints', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const { transport, release } = gatedTransport();
  release();
  await paySplit(transport);
  expect(screen.getByRole('button', { name: 'New sale' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Print receipt · New sale' })).toBeNull();
  expect(print).not.toHaveBeenCalled();
}, 20_000);

test('with auto show and auto print off, a sale goes straight back to an empty till', async () => {
  localStorage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":false,"autoShow":false}');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const { transport, release } = gatedTransport();
  release();
  await paySplit(transport, false);
  expect(await screen.findByText('Scan or tap a product to start a sale.')).not.toBeNull();
  await waitFor(() => expect(transport.send).toHaveBeenCalled());
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(screen.queryByTestId('receipt-print-area')).toBeNull();
  expect(print).not.toHaveBeenCalled();
}, 20_000);

test('with auto show off and auto print on, a sale prints once and the till returns to an empty cart', async () => {
  localStorage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":true,"autoShow":false}');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const { transport, release } = gatedTransport();
  release();
  await paySplit(transport, false);
  expect(await screen.findByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(screen.queryByTestId('receipt-print-area')).toBeNull();
}, 20_000);

test('with auto show off and auto print on, a failed print keeps the receipt with the error and Print again', async () => {
  localStorage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":true,"autoShow":false}');
  const print = vi.spyOn(window, 'print').mockImplementation(() => { throw new Error('blocked'); });
  const { transport, release } = gatedTransport();
  release();
  await paySplit(transport, false);
  expect((await screen.findByTestId('print-sheet-error')).textContent).toBe('The receipt did not print: blocked');
  expect(print).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('receipt-order')).not.toBeNull();
  expect(screen.getByTestId('receipt-print-again')).not.toBeNull();
  expect(screen.queryByText('Scan or tap a product to start a sale.')).toBeNull();
}, 20_000);
