import { noTaxSettings } from './fixtures/store-settings';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

let send: ReturnType<typeof vi.fn<CommandTransport<OrderCreateEnvelope>['send']>>;

beforeEach(async () => {
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
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
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

test('Back with a cash leg asks before cancelling, and Keep taking payment returns with the leg', () => {
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByText('Cancel this payment?')).not.toBeNull();
  expect(screen.getByText('Money already taken has to go back to the customer:')).not.toBeNull();
  expect(screen.queryAllByTestId(/^checkout-cancel-leg-/).map(element => element.textContent)).toEqual(['Return $2.00 cash to the customer']);
  expect(screen.queryByTestId('split-tender-summary')).toBeNull();
  fireEvent.click(screen.getByTestId('checkout-cancel-keep-going'));
  expect(screen.getByTestId('split-tender-summary').textContent).toContain('Paid: $2.00');
  expect(screen.queryAllByTestId(/^split-tender-row-/)).toHaveLength(1);
}, 20_000);

test('Cancel and void lists cash and card legs, then returns to the cart with nothing paid', () => {
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByTestId('split-tender-method-card'));
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '1.00' } });
  fireEvent.change(screen.getByLabelText('Terminal reference'), { target: { value: 'T-1' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryAllByTestId(/^checkout-cancel-leg-/).map(element => element.textContent)).toEqual([
    'Return $2.00 cash to the customer', 'Void $1.00 on Card',
  ]);
  fireEvent.click(screen.getByTestId('checkout-cancel-confirm'));
  expect(screen.queryByTestId('cancel-payment')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(screen.getByTestId('split-tender-summary').textContent).toContain('Paid: $0.00');
  expect(screen.queryAllByTestId(/^split-tender-row-/)).toHaveLength(0);
  expect(send).not.toHaveBeenCalled();
}, 20_000);

test('Back with no leg goes straight to the cart', () => {
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryByTestId('cancel-payment')).toBeNull();
  expect(screen.getByRole('button', { name: 'Cash' })).not.toBeNull();
  expect(screen.queryByText('Cancel this payment?')).toBeNull();
}, 20_000);

test('The Cancel payment button opens the same view', () => {
  expect(screen.queryByTestId('checkout-cancel-payment')).toBeNull();
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByTestId('checkout-cancel-payment'));
  expect(screen.getByTestId('cancel-payment')).not.toBeNull();
  expect(screen.queryAllByTestId(/^checkout-cancel-leg-/).map(element => element.textContent)).toEqual(['Return $2.00 cash to the customer']);
}, 20_000);

test('A new tender after cancelling does not reopen the view', () => {
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByTestId('checkout-cancel-confirm'));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '3.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  expect(screen.queryByTestId('cancel-payment')).toBeNull();
  expect(screen.getByTestId('split-tender-summary').textContent).toContain('Paid: $3.00');
}, 20_000);
