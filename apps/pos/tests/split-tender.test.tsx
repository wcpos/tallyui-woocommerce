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
import * as CatalogueContext from '../lib/catalogue/catalogue-context';
import type { Catalogue } from '../lib/catalogue/start-catalogue';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeCash, takeLeg } from './tender-helpers';
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
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

test.each([true, false, undefined])('uses the advertised tender UI with multiplePayments=%s', async multiplePayments => {
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
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={multiplePayments} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  if (multiplePayments === true) {
    expect(screen.getByTestId('checkout-ledger')).not.toBeNull();
    takeLeg(200);
    expect(screen.getByTestId('checkout-ledger-remaining').textContent).toBe('$4.00');
    takeLeg(400, 'pos_card');
  } else {
    expect(screen.getByTestId('checkout-keypad')).not.toBeNull();
    expect(screen.queryByTestId('checkout-ledger')).toBeNull();
    await takeCash(600);
  }
  const receipt = within((await screen.findByTestId('receipt-order')).parentElement!);
  expect(receipt.getByLabelText('Total: $6.00')).not.toBeNull();
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  const envelopes = send.mock.calls.flatMap(([batch]) => batch);
  expect(envelopes).toHaveLength(1);
  const { payments, totalMinor } = envelopes[0].payload;
  expect(payments).toEqual(multiplePayments === true
    ? [expect.objectContaining({ method: 'cash', amountMinor: 200 }), expect.objectContaining({ method: 'external', amountMinor: 400 })]
    : [expect.objectContaining({ method: 'cash', amountMinor: 600 })]);
  expect(payments.reduce((sum, payment) => sum + payment.amountMinor, 0)).toBe(totalMinor);
}, 20_000);

test('the existing outbox transport sees a catalogue capability that arrives later', async () => {
  const catalogue = vi.spyOn(CatalogueContext, 'useCatalogue').mockReturnValue({ catalogue: null, products: [], status: 'starting' });
  const fetchStub = vi.fn<typeof fetch>(async () => Response.json({
    document: { id: 115, status: 'completed', total: '6.000000' }, currentRevision: 'r1',
  }, { status: 201 }));
  vi.stubGlobal('fetch', fetchStub);
  const storage = getRxStorageMemory();
  const connector = createWooCommerceConnector();
  const view = (multiplePayments?: boolean) => (
    <SessionProvider>
      <OutboxProvider storage={storage}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={connector} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={multiplePayments} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>
  );
  const { rerender } = render(view());
  await screen.findByText('Order store ready');
  catalogue.mockReturnValue({ catalogue: { capabilities: { orderCreate: 3, multiplePayments: true } } as Catalogue,
    products, status: 'ready' });
  rerender(view(true));
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  takeLeg(200);
  takeLeg(400, 'pos_card');
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(screen.getByText('Sales are up to date.')).not.toBeNull());
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  expect(payload.payment_method).toBe('pos_card');
  expect(JSON.parse(payload.meta_data.find((entry: { key: string }) => entry.key === '_woocommerce_pos_payments').value)).toHaveLength(2);
}, 20_000);
