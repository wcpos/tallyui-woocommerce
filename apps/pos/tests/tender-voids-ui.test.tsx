import { setLineQuantity } from './cart-line-helpers';
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
import type { TenderVoidCollection } from '../lib/sale/tender-voids';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeLeg } from './tender-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

let collection: TenderVoidCollection;
let orders: (ReturnType<typeof useOutbox> & { enabled: true })['orders'];

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
  if (!outbox.enabled || !outbox.orders) return null;
  orders = outbox.orders;
  collection = outbox.orders.database.collections.tender_voids as TenderVoidCollection;
  return <span>Order store ready</span>;
}

async function renderSale(multiplePayments?: boolean) {
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
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
}

function addCash() {
  takeLeg(200);
}

test('Remove journals the cash leg before it leaves the sale', async () => {
  await renderSale(true);
  addCash();
  fireEvent.click(screen.getByTestId(/^checkout-remove-leg-/));
  await waitFor(() => expect(screen.queryByTestId(/^checkout-leg-/)).toBeNull());
  const rows = await collection.find().exec();
  expect(rows).toHaveLength(1);
  expect(rows[0].toJSON()).toMatchObject({
    reason: 'removed', method: 'cash', amountMinor: 200, currency: 'USD', cashierRef: '2',
    registerId: 'web', type: 'void', saleId: expect.stringMatching(/\S/),
  });
}, 20_000);

test("a void carries the register id of the sale's order row", async () => {
  await renderSale(true);
  addCash();
  fireEvent.click(screen.getByTestId(/^checkout-remove-leg-/));
  await waitFor(() => expect(screen.queryByTestId(/^checkout-leg-/)).toBeNull());
  takeLeg(600);
  await waitFor(async () => expect(await orders!.find().exec()).toHaveLength(1));
  const [order] = await orders!.find().exec();
  const rows = await collection.find().exec();
  expect(rows).toHaveLength(1);
  expect(order.registerId).toBe('web');
  expect(rows[0].registerId).toBe(order.registerId);
  expect(rows[0].registerId).not.toBe('');
}, 20_000);

test('Cancel and void journals every leg with the same sale id', async () => {
  await renderSale(true);
  addCash();
  // A card leg short of the balance: covering it would complete the sale before Back.
  takeLeg(100, 'pos_card');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByTestId('checkout-cancel-confirm'));
  expect(await screen.findByTestId('cart-checkout')).not.toBeNull();
  const rows = (await collection.find().exec()).map(doc => doc.toJSON());
  expect(rows).toHaveLength(2);
  expect(rows.map(row => row.reason)).toEqual(['cancelled', 'cancelled']);
  expect(rows[0].saleId).toBe(rows[1].saleId);
}, 20_000);

test('a failed Remove keeps the leg and shows the write error', async () => {
  await renderSale(true);
  vi.spyOn(collection, 'bulkInsert').mockRejectedValueOnce(new Error('disk full'));
  addCash();
  fireEvent.click(screen.getByTestId(/^checkout-remove-leg-/));
  expect((await screen.findByTestId('tender-void-error')).textContent).toContain('disk full');
  expect(screen.getByTestId(/^checkout-leg-/)).not.toBeNull();
  expect(await collection.find().exec()).toHaveLength(0);
}, 20_000);

test('a failed Cancel and void keeps the cancel view and can be retried', async () => {
  await renderSale(true);
  vi.spyOn(collection, 'bulkInsert').mockRejectedValueOnce(new Error('disk full'));
  addCash();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByTestId('checkout-cancel-confirm'));
  expect((await screen.findByTestId('tender-void-error')).textContent).toContain('disk full');
  expect(screen.getByTestId('cancel-payment')).not.toBeNull();
  expect(screen.getAllByTestId(/^checkout-cancel-leg-/)).toHaveLength(1);
  expect(await collection.find().exec()).toHaveLength(0);
  fireEvent.click(screen.getByTestId('checkout-cancel-confirm'));
  expect(await screen.findByTestId('cart-checkout')).not.toBeNull();
  expect(await collection.find().exec()).toHaveLength(1);
  expect(screen.queryByTestId('tender-void-error')).toBeNull();
}, 20_000);

test('Back with no legs returns to the cart without a void', async () => {
  await renderSale(true);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByTestId('cart-checkout')).not.toBeNull();
  expect(await collection.find().exec()).toHaveLength(0);
}, 20_000);

test('single tender Back returns to the cart without a void', async () => {
  await renderSale();
  expect(screen.getByTestId('checkout-keypad')).not.toBeNull();
  fireEvent.click(screen.getByTestId('checkout-keypad-key-clear'));
  fireEvent.click(screen.getByTestId('checkout-keypad-key-2'));
  fireEvent.click(screen.getByTestId('checkout-keypad-key-0'));
  fireEvent.click(screen.getByTestId('checkout-keypad-key-0'));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByTestId('cart-checkout')).not.toBeNull();
  expect(await collection.find().exec()).toHaveLength(0);
}, 20_000);

test('double tapping Remove records exactly one void', async () => {
  await renderSale(true);
  addCash();
  const remove = screen.getByTestId(/^checkout-remove-leg-/);
  fireEvent.click(remove);
  fireEvent.click(remove);
  await waitFor(() => expect(screen.queryByTestId(/^checkout-leg-/)).toBeNull());
  expect(await collection.find().exec()).toHaveLength(1);
}, 20_000);

test('a failed save hides Remove and records no void', async () => {
  await renderSale(true);
  vi.spyOn(orders!, 'insert').mockRejectedValue(new Error('disk full'));
  takeLeg(600);
  await screen.findByText('The sale could not be saved: disk full');
  expect(screen.queryAllByTestId(/^checkout-remove-leg-/)).toHaveLength(0);
  expect(screen.getByTestId(/^checkout-leg-/)).not.toBeNull();
  expect(await collection.find().exec()).toHaveLength(0);
}, 20_000);
