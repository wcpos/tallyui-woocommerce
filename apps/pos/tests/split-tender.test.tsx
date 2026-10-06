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
        <SaleScreen connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          multiplePayments={multiplePayments} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  if (multiplePayments === true) {
    expect(screen.getByTestId('split-tender-summary')).not.toBeNull();
    expect(screen.queryByText('Cash Tendered')).toBeNull();
    fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
    fireEvent.click(screen.getByTestId('split-tender-add-button'));
    fireEvent.click(screen.getByTestId('split-tender-method-card'));
    expect((screen.getByLabelText('Tender amount') as HTMLInputElement).value).toBe('4.00');
    fireEvent.click(screen.getByTestId('split-tender-add-button'));
  } else {
    expect(screen.getByText('Cash Tendered')).not.toBeNull();
    expect(screen.queryByTestId('split-tender-summary')).toBeNull();
    const tender = within(screen.getByRole('button', { name: 'Complete sale' }).parentElement!);
    fireEvent.change(tender.getByRole('textbox'), { target: { value: '6.00' } });
  }
  fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
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
        <SaleScreen connector={connector} currency={stores[0].currency} products={products}
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
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  fireEvent.change(screen.getByLabelText('Tender amount'), { target: { value: '2.00' } });
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByTestId('split-tender-method-card'));
  fireEvent.click(screen.getByTestId('split-tender-add-button'));
  fireEvent.click(screen.getByRole('button', { name: 'Complete sale' }));
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(screen.getByText('Sales are up to date.')).not.toBeNull());
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  expect(payload.payment_method).toBe('pos_card');
  expect(JSON.parse(payload.meta_data.find((entry: { key: string }) => entry.key === '_woocommerce_pos_payments').value)).toHaveLength(2);
}, 20_000);
