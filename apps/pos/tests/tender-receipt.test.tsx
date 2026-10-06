import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { OrderCreateEnvelope } from '@tallyui/core';
import type { CommandTransport } from '@tallyui/pos';
import { SaleScreen } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
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
        <SaleScreen connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  expect(screen.getByText('Sales are up to date.')).not.toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(screen.getByText('Cash Tendered')).not.toBeNull();
  expect(screen.queryByText('Taking payment arrives in the next update')).toBeNull();
  const complete = screen.getByRole('button', { name: 'Complete sale' });
  const tender = within(complete.parentElement!);
  fireEvent.change(tender.getByRole('textbox'), { target: { value: '10.00' } });
  fireEvent.click(complete);
  const receiptOrder = await screen.findByTestId('receipt-order');
  const receipt = within(receiptOrder.parentElement!);
  expect(receipt.getByText(stores[0].name)).not.toBeNull();
  expect(receipt.getByLabelText('Total: $6.00')).not.toBeNull();
  expect(receipt.queryByText(/\(draft\)/)).toBeNull();
  await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
  expect(send.mock.calls.flatMap(([batch]) => batch)).toEqual([expect.objectContaining({ type: 'order.create' })]);
  await waitFor(() => expect(screen.getByText('Sales are up to date.')).not.toBeNull());
  fireEvent.click(receipt.getByRole('button', { name: 'New sale' }));
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(screen.queryByTestId('receipt-order')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
  expect(send).toHaveBeenCalledTimes(1);
}, 20_000);
