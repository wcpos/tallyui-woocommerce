import { setLineQuantity } from './cart-line-helpers';
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
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { takeLeg } from './tender-helpers';
import { classesOf } from './classes-of';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

let orders: (ReturnType<typeof useOutbox> & { enabled: true })['orders'];
let send: ReturnType<typeof vi.fn<CommandTransport<OrderCreateEnvelope>['send']>>;

beforeEach(async () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  // Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
  const data = new Map<string, string>([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
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
  send = vi.fn<CommandTransport<OrderCreateEnvelope>['send']>(async batch => ({
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
          multiplePayments />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  setLineQuantity('Espresso', 2);
  fireEvent.click(screen.getByTestId('cart-checkout'));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function OrderStoreReady() {
  const outbox = useOutbox();
  if (!outbox.enabled || !outbox.orders) return null;
  orders = outbox.orders;
  return <span>Order store ready</span>;
}

test('Back with a cash leg asks before cancelling, and Keep taking payment returns with the leg', () => {
  takeLeg(200);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('Cancel this payment?')).not.toBeNull();
  expect(screen.getByText('Money already taken has to go back to the customer:')).not.toBeNull();
  expect(screen.queryAllByTestId(/^checkout-cancel-leg-/).map(element => element.textContent)).toEqual(['Return $2.00 cash to the customer']);
  expect(screen.queryByTestId('checkout-tender')).toBeNull();
  fireEvent.click(screen.getByTestId('checkout-cancel-keep-going'));
  expect(screen.getByTestId('checkout-ledger-totals').textContent).toContain('Paid$2.00');
  expect(screen.queryAllByTestId(/^checkout-leg-/)).toHaveLength(1);
}, 20_000);

test('Cancel and void lists cash and card legs, then returns to the cart with nothing paid', async () => {
  takeLeg(200);
  fireEvent.click(screen.getByTestId('checkout-method-pos_card'));
  fireEvent.change(screen.getByLabelText('Terminal reference'), { target: { value: 'T-1' } });
  takeLeg(100, 'pos_card');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryAllByTestId(/^checkout-cancel-leg-/).map(element => element.textContent)).toEqual([
    'Return $2.00 cash to the customer', 'Void $1.00 on Card',
  ]);
  fireEvent.click(screen.getByTestId('checkout-cancel-confirm'));
  await waitFor(() => expect(screen.queryByTestId('cancel-payment')).toBeNull());
  fireEvent.click(screen.getByTestId('cart-checkout'));
  expect(screen.getByTestId('checkout-ledger-totals').textContent).toContain('Paid$0.00');
  expect(screen.queryAllByTestId(/^checkout-leg-/)).toHaveLength(0);
  expect(send).not.toHaveBeenCalled();
}, 20_000);

test('Back with no leg goes straight to the cart', () => {
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryByTestId('cancel-payment')).toBeNull();
  expect(screen.getByTestId('cart-checkout')).not.toBeNull();
  expect(screen.queryByText('Cancel this payment?')).toBeNull();
}, 20_000);

test('The Cancel payment button opens the same view', () => {
  expect(screen.queryByTestId('checkout-cancel-payment')).toBeNull();
  takeLeg(200);
  expect(screen.getByTestId('checkout-cancel-payment').getAttribute('aria-disabled')).not.toBe('true');
  fireEvent.click(screen.getByTestId('checkout-cancel-payment'));
  expect(screen.getByTestId('cancel-payment')).not.toBeNull();
  expect(screen.queryAllByTestId(/^checkout-cancel-leg-/).map(element => element.textContent)).toEqual(['Return $2.00 cash to the customer']);
}, 20_000);

test('A new tender after cancelling does not reopen the view', async () => {
  takeLeg(200);
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByTestId('checkout-cancel-confirm'));
  fireEvent.click(await screen.findByTestId('cart-checkout'));
  takeLeg(300);
  expect(screen.queryByTestId('cancel-payment')).toBeNull();
  expect(screen.getByTestId('checkout-ledger-totals').textContent).toContain('Paid$3.00');
}, 20_000);

test('Cancel payment is v2\'s outline-destructive, sm beside the title on a wide screen', () => {
  takeLeg(200);
  const classes = classesOf('checkout-cancel-payment');
  expect(classes).toEqual(expect.arrayContaining(['border', 'border-destructive', 'bg-card', 'h-9']));
  expect(classes).not.toContain('h-10');
}, 20_000);

test('While the order saves, Cancel payment is disabled and a press opens no confirm', async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const insert = orders!.insert.bind(orders!);
  vi.spyOn(orders!, 'insert').mockImplementationOnce(async doc => { await gate; return insert(doc); });
  takeLeg(200);
  takeLeg(400);
  await waitFor(() => expect(screen.getByTestId('checkout-commit').textContent).toBe('Saving order…'));
  expect(screen.getByTestId('checkout-cancel-payment').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('checkout-cancel-payment'));
  expect(screen.queryByTestId('cancel-payment')).toBeNull();
  release();
  expect(await screen.findByTestId('receipt-order')).not.toBeNull();
}, 20_000);
