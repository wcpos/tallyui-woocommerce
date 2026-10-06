import { noTaxSettings } from './fixtures/store-settings';
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { ServerCapabilities } from '@tallyui/core';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

const CHARGES: ServerCapabilities = { orderCreate: 5, lineTax: { none: true, classes: true },
  taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false } };
let fetchStub: ReturnType<typeof vi.fn<typeof fetch>>;

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
  fetchStub = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === 'POST' && url.pathname.endsWith('/push/orders')) {
      return Response.json({ document: { id: 301, number: '301', status: 'completed', total: '11.200000' } }, { status: 201 });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchStub);
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

test('sells a fee, a shipping charge and a custom item and pushes them to WooCommerce', async () => {
  render(
    <SessionProvider>
      <OutboxProvider storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency="USD" products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} capabilities={CHARGES} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Add charge' }));
  const fee = within(screen.getByTestId('charge-form'));
  fireEvent.change(fee.getByLabelText('Name'), { target: { value: 'Bag' } });
  fireEvent.change(fee.getByLabelText('Amount'), { target: { value: '0.20' } });
  fireEvent.click(fee.getByRole('button', { name: 'Apply' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add charge' }));
  const shipping = within(screen.getByTestId('charge-form'));
  fireEvent.click(shipping.getByRole('button', { name: 'Shipping' }));
  fireEvent.change(shipping.getByLabelText('Name'), { target: { value: 'Delivery' } });
  fireEvent.change(shipping.getByLabelText('Amount'), { target: { value: '5.00' } });
  fireEvent.click(shipping.getByRole('button', { name: 'Apply' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add charge' }));
  const custom = within(screen.getByTestId('charge-form'));
  fireEvent.click(custom.getByRole('button', { name: 'Custom item' }));
  fireEvent.change(custom.getByLabelText('Name'), { target: { value: 'Gift wrap' } });
  fireEvent.change(custom.getByLabelText('Amount'), { target: { value: '3.00' } });
  fireEvent.click(custom.getByRole('switch', { name: 'No tax' }));
  fireEvent.click(custom.getByRole('button', { name: 'Apply' }));
  const feeRow = within(screen.getByTestId('cart-fee-0'));
  expect(feeRow.getByText('Bag')).not.toBeNull();
  expect(feeRow.getByText('$0.20')).not.toBeNull();
  const shippingRow = within(screen.getByTestId('cart-shipping-0'));
  expect(shippingRow.getByText('Delivery')).not.toBeNull();
  expect(shippingRow.getByText('$5.00')).not.toBeNull();
  const footer = within(screen.getByTestId('cart-footer'));
  expect(within(footer.getByText('Total').parentElement!).getByText('$11.20')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  const complete = screen.getByRole('button', { name: 'Complete sale' });
  fireEvent.change(within(complete.parentElement!).getByRole('textbox'), { target: { value: '20.00' } });
  fireEvent.click(complete);
  const receiptOrder = await screen.findByTestId('receipt-order');
  const receipt = within(receiptOrder.parentElement!);
  expect(receipt.getByLabelText('Bag: $0.20')).not.toBeNull();
  expect(receipt.getByLabelText('Delivery: $5.00')).not.toBeNull();
  expect(receipt.getByLabelText('Total: $11.20')).not.toBeNull();
  await waitFor(() => expect(screen.getByText('Sales are up to date.')).not.toBeNull());
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const payload = JSON.parse(String(fetchStub.mock.calls[0][1]?.body)).payload;
  expect(payload.line_items).toEqual([
    { product_id: 80, quantity: 1, subtotal: '3.00', total: '3.00' },
    { product_id: 0, name: 'Gift wrap', quantity: 1, subtotal: '3.00', total: '3.00', tax_class: '',
      meta_data: [{ key: '_woocommerce_pos_data', value: JSON.stringify({ price: '3.00', regular_price: '3.00', tax_status: 'none' }) }] },
  ]);
  expect(payload.fee_lines).toEqual([{ name: 'Bag', total: '0.20', tax_status: 'taxable', tax_class: '' }]);
  expect(payload.shipping_lines).toEqual([{ method_id: 'pos', method_title: 'Delivery', total: '5.00' }]);
}, 20_000);

test('offers no charges when the store has no capabilities read', async () => {
  render(
    <SessionProvider>
      <OutboxProvider storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency="USD" products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  expect(screen.queryByRole('button', { name: 'Add charge' })).toBeNull();
});
