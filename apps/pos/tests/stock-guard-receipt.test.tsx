import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
import { dismissToast, getToasts } from '../lib/toast/toast';
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
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  localStorage.setItem(RECEIPT_SETTINGS_KEY, '{"autoPrint":false,"autoShow":true}');
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.head.querySelectorAll('style[data-receipt-print], style[data-receipt-page]').forEach(style => style.remove());
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

function gatedTransport() {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => {
    await gate;
    return { kind: 'results', results: batch.map(envelope => ({ id: envelope.id, status: 'applied', serverRefs: { orderId: '115', totalMinor: 300 } })) };
  });
  return { transport: { send }, release };
}

async function paySplit(transport: { send: CommandTransport<OrderCreateEnvelope>['send'] }) {
  render(
    <SessionProvider>
      <OutboxProvider transportFor={() => transport} storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={{ ...noTaxSettings, preventOverselling: true }} connector={createWooCommerceConnector()}
          currency={stores[0].currency} products={[{ ...products[0], stock_quantity: 1 }]}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(100);
  expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe('$2.00');
  takeLeg(200, 'pos_card');
  await screen.findByTestId('receipt-order');
}

test('with prevent overselling on, an add from the receipt counts the new sale, not the finished one', async () => {
  const { transport, release } = gatedTransport();
  release();
  await paySplit(transport);
  expect(screen.getByTestId('checkout-paid-headline').textContent).toContain('Paid $3.00');
  act(() => dismissToast());
  fireEvent.click(within(screen.getByTestId('pos-products-panel')).getByText('Espresso'));
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(screen.getByLabelText('Edit quantity of Espresso').textContent).toBe('1');
  expect(getToasts().some(toast => /Only .* available/.test(toast.title))).toBe(false);
}, 20_000);
