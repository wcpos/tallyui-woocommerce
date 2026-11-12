import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StoreSettings } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import * as CatalogueContext from '../lib/catalogue/catalogue-context';
import type { Catalogue } from '../lib/catalogue/start-catalogue';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

const taxRateTable: NonNullable<StoreSettings['taxRateTable']> = [
  { id: 1, country: 'US', state: 'CA', postcode: '', city: '', postcodes: [], cities: [], rate: '10.0000',
    name: 'CA Tax', class: 'standard', priority: 1, compound: false, shipping: true, order: 0 },
  { id: 2, country: 'GB', state: '', postcode: '', city: '', postcodes: [], cities: [], rate: '20.0000',
    name: 'VAT', class: 'standard', priority: 1, compound: false, shipping: true, order: 0 },
];
const taxed: StoreSettings = {
  ...noTaxSettings, taxBasedOn: 'billing',
  baseTaxAddress: { country: 'US', state: 'CA', city: '', postcode: '' },
  taxRatesPpm: { default: 100000 },
  taxRates: { standard: [{ id: 1, code: 'US-CA-CA TAX-1', label: 'CA Tax', rate: '10.0000',
    priority: 1, compound: false, shipping: true }] },
  taxRateTable,
};
const customer = { id: '7', name: 'Ann Lee', billing: { country: 'GB', city: 'London', postcode: 'N1 1AA' } };
const saleProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2', status: 'ready' as const, onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  const home = `https://shop.example/${crypto.randomUUID()}`;
  saveSession({
    site: { name: stores[0].name, home, wpApiUrl: `${home}/wp-json`, wcposApiUrl: `${home}/wp-json/wcpos/v2`, authUrl: `${home}/wcpos-auth/` },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function renderSale(props: Pick<SaleScreenProps, 'storeSettings' | 'capabilities' | 'defaultCustomer' | 'onOpenTaxSettings'>) {
  render(<><SaleScreen {...saleProps} {...props} /><PortalHost /></>);
}

test('taxes off leaves the caption start empty with no trigger', () => {
  renderSale({ storeSettings: noTaxSettings });
  expect(screen.queryByTestId('tax-based-on-trigger')).toBeNull();
  expect(screen.getByTestId('data-table-caption-start').childNodes).toHaveLength(0);
});

test('base shows Shop base in the caption start', () => {
  renderSale({ storeSettings: { ...taxed, taxBasedOn: 'base' } });
  expect(within(screen.getByTestId('data-table-caption-start')).getByTestId('tax-based-on-value').textContent).toBe('Shop base');
});

test.each([
  { orderCreate: 8, total: '$3.60', address: 'Address on the order', rate: 'VAT', absent: 'CA Tax' },
  { orderCreate: 5, total: '$3.30', address: 'Shop address', rate: 'CA Tax', absent: 'This order has no billing address' },
])('order.create $orderCreate uses the matching address and rates in the panel and cart', ({ orderCreate, total, address, rate, absent }) => {
  renderSale({ storeSettings: taxed, capabilities: { orderCreate }, defaultCustomer: customer });
  expect(screen.getByTestId('tax-based-on-value').textContent).toBe('Customer billing address');
  fireEvent.click(screen.getByTestId('tax-based-on-trigger'));
  const panel = screen.getByTestId('tax-based-on-content');
  expect(panel.textContent).toContain(address);
  expect(panel.textContent).toContain(rate);
  expect(panel.textContent).not.toContain(absent);
  fireEvent.click(screen.getByTestId('tax-based-on-trigger'));
  fireEvent.click(screen.getByText('Espresso'));
  // Without useSale's taxContextFor the order.create 8 total is $3.30, despite the customer's GB address.
  expect(screen.getByTestId('cart-checkout').textContent).toBe(`Checkout ${total}`);
});

test('the panel opens tax settings through the supplied callback', () => {
  const onOpenTaxSettings = vi.fn();
  renderSale({ storeSettings: taxed, onOpenTaxSettings });
  fireEvent.click(screen.getByTestId('tax-based-on-trigger'));
  fireEvent.click(screen.getByTestId('tax-based-on-change-setting'));
  expect(onOpenTaxSettings).toHaveBeenCalledTimes(1);
});

function OrderStoreReady() {
  const outbox = useOutbox();
  return outbox.enabled && outbox.orders ? <span>Order store ready</span> : null;
}

async function takeCash(minor: number): Promise<void> {
  await screen.findByTestId('checkout-keypad');
  fireEvent.click(screen.getByTestId('checkout-keypad-key-clear'));
  for (const digit of String(minor)) fireEvent.click(screen.getByTestId(`checkout-keypad-key-${digit}`));
  fireEvent.click(screen.getByTestId('checkout-commit'));
}

test.each([
  { orderCreate: 8, minor: 360 },
  { orderCreate: 5, minor: 330 },
])('order.create $orderCreate sends tax address metadata only when supported', async ({ orderCreate, minor }) => {
  vi.spyOn(CatalogueContext, 'useCatalogue').mockReturnValue({
    catalogue: { capabilities: { orderCreate } } as Catalogue, products, status: 'ready',
  });
  const fetchStub = vi.fn<typeof fetch>(async () => Response.json({
    document: { id: 115, status: 'completed', total: (minor / 100).toFixed(6) }, currentRevision: 'r1',
  }, { status: 201 }));
  vi.stubGlobal('fetch', fetchStub);
  render(
    <SessionProvider>
      <OutboxProvider storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...saleProps} storeSettings={taxed} capabilities={{ orderCreate }} defaultCustomer={customer} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(minor);
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  expect(fetchStub).toHaveBeenCalledTimes(1);
  const { payload } = JSON.parse(fetchStub.mock.calls[0][1]!.body as string);
  if (orderCreate === 8) {
    expect(payload.meta_data).toContainEqual({ key: '_woocommerce_pos_tax_based_on', value: 'billing' });
    expect(payload.billing.country).toBe('GB');
  } else {
    expect(payload.meta_data).not.toContainEqual(expect.objectContaining({ key: '_woocommerce_pos_tax_based_on' }));
  }
}, 20_000);
