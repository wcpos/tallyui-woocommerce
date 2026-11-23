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
import { takeCash } from './tender-helpers';
import { openAddMenuItem } from './cart-head-helpers';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';

const CHARGES: ServerCapabilities = { orderCreate: 5, lineTax: { none: true, classes: true },
  taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false } };
const NO_V5: ServerCapabilities = { orderCreate: 3, multiplePayments: false, lineTax: { none: true, classes: true },
  taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false } };
let fetchStub: ReturnType<typeof vi.fn<typeof fetch>>;
const posts = () => fetchStub.mock.calls.filter(([, init]) => init?.method === 'POST');

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
    if (url.pathname.endsWith('/site')) return Response.json({ wcpos_version: '1.10.20' }); // connector 4.0.0 reads /site once
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal('fetch', fetchStub);
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
  openAddMenuItem('fee');
  const fee = within(screen.getByTestId('charge-form'));
  fireEvent.change(fee.getByLabelText('Name'), { target: { value: 'Bag' } });
  fireEvent.change(fee.getByLabelText('Amount'), { target: { value: '0.20' } });
  fireEvent.click(fee.getByRole('button', { name: 'Add to Cart' }));
  openAddMenuItem('shipping');
  const shipping = within(screen.getByTestId('charge-form'));
  fireEvent.change(shipping.getByLabelText('Name'), { target: { value: 'Delivery' } });
  fireEvent.change(shipping.getByLabelText('Amount'), { target: { value: '5.00' } });
  fireEvent.click(shipping.getByRole('button', { name: 'Add to Cart' }));
  openAddMenuItem('misc-product');
  const custom = within(screen.getByTestId('charge-form'));
  fireEvent.change(custom.getByLabelText('Name'), { target: { value: 'Gift wrap' } });
  fireEvent.change(custom.getByLabelText('Amount'), { target: { value: '3.00' } });
  fireEvent.click(custom.getByRole('switch', { name: 'No tax' }));
  fireEvent.click(custom.getByRole('button', { name: 'Add to Cart' }));
  const feeRow = within(screen.getByTestId('cart-fee-0'));
  expect(feeRow.getByText('Bag')).not.toBeNull();
  expect(feeRow.getByTestId('cart-charge-total').textContent).toBe('$0.20'); // 4.0.0 4319b3c: Price and Total cells
  const shippingRow = within(screen.getByTestId('cart-shipping-0'));
  expect(shippingRow.getByText('Delivery')).not.toBeNull();
  expect(shippingRow.getByTestId('cart-charge-total').textContent).toBe('$5.00');
  const footer = within(screen.getByTestId('cart-footer'));
  expect(within(footer.getByText('Total').parentElement!).getByText('$11.20')).not.toBeNull();
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(2000);
  const receiptOrder = await screen.findByTestId('receipt-order');
  const receipt = within(receiptOrder.parentElement!);
  expect(receipt.getByLabelText('Bag: $0.20')).not.toBeNull();
  expect(receipt.getByLabelText('Delivery: $5.00')).not.toBeNull();
  expect(receipt.getByLabelText('Total: $11.20')).not.toBeNull();
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(posts()).toHaveLength(1);
  const payload = JSON.parse(String(posts()[0][1]?.body)).payload;
  expect(payload.line_items).toEqual([
    { product_id: 80, quantity: 1, subtotal: '3.00', total: '3.00' },
    { product_id: 0, name: 'Gift wrap', quantity: 1, subtotal: '3.00', total: '3.00', tax_class: '',
      meta_data: [{ key: '_woocommerce_pos_data', value: JSON.stringify({ price: '3.00', regular_price: '3.00', tax_status: 'none' }) }] },
  ]);
  expect(payload.fee_lines).toEqual([{ name: 'Bag', total: '0.20', tax_status: 'taxable', tax_class: '' }]);
  expect(payload.shipping_lines).toEqual([{ method_id: 'pos', method_title: 'Delivery', total: '5.00' }]);
}, 20_000);

test('pushes a percent fee and a custom item SKU to WooCommerce', async () => {
  fetchStub.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === 'POST' && url.pathname.endsWith('/push/orders')) {
      return Response.json({ document: { id: 301, number: '301', status: 'completed', total: '6.600000' } }, { status: 201 });
    }
    if (url.pathname.endsWith('/site')) return Response.json({ wcpos_version: '1.10.20' });
    throw new Error(`Unexpected request: ${url}`);
  });
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
  openAddMenuItem('fee');
  const fee = within(screen.getByTestId('charge-form'));
  fireEvent.change(fee.getByRole('textbox', { name: 'Name' }), { target: { value: 'Service' } });
  fireEvent.click(within(fee.getByRole('group', { name: 'Amount unit' })).getByRole('button', { name: '%' }));
  fireEvent.change(fee.getByRole('textbox', { name: 'Amount' }), { target: { value: '10' } });
  fireEvent.click(fee.getByRole('button', { name: 'Add to Cart' }));
  expect(within(screen.getByTestId('cart-fee-0')).getByTestId('cart-charge-total').textContent).toBe('$0.30');
  openAddMenuItem('misc-product');
  const custom = within(screen.getByTestId('charge-form'));
  fireEvent.change(custom.getByRole('textbox', { name: 'Name' }), { target: { value: 'Gift wrap' } });
  fireEvent.change(custom.getByRole('textbox', { name: 'Amount' }), { target: { value: '3.00' } });
  fireEvent.click(custom.getByRole('button', { name: '+ SKU' }));
  fireEvent.change(custom.getByRole('textbox', { name: 'SKU' }), { target: { value: 'GW-1' } });
  fireEvent.click(custom.getByRole('button', { name: 'Add to Cart' }));
  // @tallyui/pos 4.2.0 dist/index.js:1542-1550 recalculates over all product lines: 10% of $6.00 after Gift wrap.
  const feeRow = within(screen.getByTestId('cart-fee-0'));
  expect(feeRow.getByText('Service')).not.toBeNull();
  expect(feeRow.getByTestId('cart-charge-total').textContent).toBe('$0.60');
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(1000);
  const receiptOrder = await screen.findByTestId('receipt-order');
  expect(within(receiptOrder.parentElement!).getByLabelText('Total: $6.60')).not.toBeNull();
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(posts()).toHaveLength(1);
  const payload = JSON.parse(String(posts()[0][1]?.body)).payload;
  expect(payload.fee_lines).toEqual([{ name: 'Service', total: '0.60', tax_status: 'taxable', tax_class: '' }]);
  expect(payload.line_items).toEqual(expect.arrayContaining([
    expect.objectContaining({ product_id: 0, name: 'Gift wrap', total: '3.00', sku: 'GW-1' }),
  ]));
}, 20_000);

test('pushes an inclusive fee as net and includes its tax in the receipt total', async () => {
  fetchStub.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === 'POST' && url.pathname.endsWith('/push/orders')) {
      return Response.json({ document: { id: 301, number: '301', status: 'completed', total: '4.400000' } }, { status: 201 });
    }
    if (url.pathname.endsWith('/site')) return Response.json({ wcpos_version: '1.10.20' });
    throw new Error(`Unexpected request: ${url}`);
  });
  render(
    <SessionProvider>
      <OutboxProvider storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={{ ...noTaxSettings, taxRatesPpm: { default: 100000 } }} connector={createWooCommerceConnector()}
          currency="USD" products={products} storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready"
          onSignOut={() => {}} capabilities={{ orderCreate: 5, lineTax: CHARGES.lineTax }} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  openAddMenuItem('fee');
  const fee = within(screen.getByTestId('charge-form'));
  fireEvent.change(fee.getByRole('textbox', { name: 'Name' }), { target: { value: 'Bag' } });
  fireEvent.change(fee.getByRole('textbox', { name: 'Amount' }), { target: { value: '1.10' } });
  fireEvent.click(fee.getByRole('switch', { name: 'Amount Includes Tax' }));
  fireEvent.click(fee.getByRole('button', { name: 'Add to Cart' }));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(500);
  const receiptOrder = await screen.findByTestId('receipt-order');
  expect(within(receiptOrder.parentElement!).getByLabelText('Total: $4.40')).not.toBeNull();
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(posts()).toHaveLength(1);
  const payload = JSON.parse(String(posts()[0][1]?.body)).payload;
  expect(payload.fee_lines).toEqual([{ name: 'Bag', total: '1.00', tax_status: 'taxable', tax_class: '' }]);
}, 20_000);

test('a store without order_create_v5 sells on the v3 fallback: no charges, one cash payment, no fee or shipping lines', async () => {
  fetchStub.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (init?.method === 'POST' && url.pathname.endsWith('/push/orders')) {
      return Response.json({ document: { id: 301, number: '301', status: 'completed', total: '3.000000' } }, { status: 201 });
    }
    if (url.pathname.endsWith('/site')) return Response.json({ wcpos_version: '1.10.20' }); // connector 4.0.0 reads /site once
    throw new Error(`Unexpected request: ${url}`);
  });
  render(
    <SessionProvider>
      <OutboxProvider storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency="USD" products={products}
          storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}}
          capabilities={NO_V5} multiplePayments={false} />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  expect(screen.getByTestId('cart-add-menu-discount')).not.toBeNull();
  for (const item of ['misc-product', 'fee', 'shipping']) expect(screen.queryByTestId(`cart-add-menu-${item}`)).toBeNull();
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(500);
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(posts()).toHaveLength(1);
  const payload = JSON.parse(String(posts()[0][1]?.body)).payload;
  expect(payload.line_items).toEqual([{ product_id: 80, quantity: 1, subtotal: '3.00', total: '3.00' }]);
  expect(payload.fee_lines ?? []).toEqual([]);
  expect(payload.shipping_lines ?? []).toEqual([]);
  expect(payload.payment_method).toBe('pos_cash');
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
  fireEvent.click(screen.getByTestId('cart-add-menu'));
  expect(screen.getByTestId('cart-add-menu-discount')).not.toBeNull();
  for (const item of ['misc-product', 'fee', 'shipping']) expect(screen.queryByTestId(`cart-add-menu-${item}`)).toBeNull();
  fireEvent.click(screen.getByTestId('cart-add-menu'));
});
