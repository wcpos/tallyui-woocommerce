import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { StoreSettings } from '@tallyui/core';
import { PortalHost } from '@tallyui/primitives';
import { ProductsScreen } from '../components/products-screen';
import { TaxBasedOnCaption } from '../components/tax-based-on-caption';
import { SaleScreen, type SaleScreenProps } from '../components/sale-screen';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import * as CatalogueContext from '../lib/catalogue/catalogue-context';
import type { Catalogue } from '../lib/catalogue/start-catalogue';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { OutboxProvider, useOutbox } from '../lib/sale/outbox-context';
import { parkedCartMigrationStrategies, parkedCartSchema, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { parkedTabs, resumeFromList } from './open-orders-helpers';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

const onOpenTaxSettings = vi.fn();
addRxPlugin(RxDBMigrationSchemaPlugin);

// The shop is in California (CA Tax 10%); the table also holds GB VAT 20%, which only a GB address matches.
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
  onOpenTaxSettings.mockClear();
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
  render(<><SaleScreen {...saleProps} onOpenTaxSettings={onOpenTaxSettings} {...props} /><PortalHost /></>);
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
  // order.create 8: the GB billing address matches VAT only; Espresso 3.00 + 3.00 × 20% (0.60) = 3.60.
  { orderCreate: 8, total: '$3.60', address: 'Address on the order', rate: 'VAT', absent: 'CA Tax' },
  // order.create 5: the server taxes on the CA base, so CA Tax only; 3.00 + 3.00 × 10% (0.30) = 3.30, and no fallback note.
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
  // Without useSale's taxContextFor the order.create 8 total is 3.00 + 0.30 = $3.30, despite the customer's GB address.
  expect(screen.getByTestId('cart-checkout').textContent).toBe(`Checkout ${total}`);
});

test("the till's panel links to Settings › Tax and lists View all tax rates", () => {
  renderSale({ storeSettings: taxed });
  fireEvent.click(screen.getByTestId('tax-based-on-trigger'));
  expect(screen.getByTestId('tax-based-on-view-all').textContent).toContain('View all tax rates');
  fireEvent.click(screen.getByTestId('tax-based-on-change-setting'));
  expect(onOpenTaxSettings).toHaveBeenCalledOnce();
});

test('without onOpenTaxSettings the till shows no caption', () => {
  renderSale({ storeSettings: taxed, onOpenTaxSettings: undefined });
  expect(screen.getByTestId('data-table-caption-start').childNodes).toHaveLength(0);
});

test("the Products screen's caption, given no location, stays on the shop base whatever the setting", () => {
  render(<ProductsScreen products={products} connector={saleProps.connector} currency="USD" locale="en_US" onBack={vi.fn()}
    captionStart={<TaxBasedOnCaption settings={taxed} calcTaxes onChangeSetting={vi.fn()} />} />,
  { wrapper: ({ children }) => <>{children}<PortalHost /></> });
  const start = within(screen.getByTestId('products-caption-start'));
  expect(start.getByTestId('tax-based-on-value').textContent).toBe('Customer billing address');
  fireEvent.click(start.getByTestId('tax-based-on-trigger'));
  const panel = screen.getByTestId('tax-based-on-content').textContent;
  // No order: the shop's CA base, with no customer fallback note, and never the GB rate.
  expect(panel).toContain('Shop address');
  expect(panel).toContain('CA Tax');
  expect(panel).not.toContain('VAT');
  expect(panel).not.toContain('This order has no');
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
  // Exact cash for 3.00 + 3.00 × 20% = 3.60.
  { orderCreate: 8, minor: 360 },
  // Exact cash for 3.00 + 3.00 × 10% = 3.30.
  { orderCreate: 5, minor: 330 },
])('order.create $orderCreate sends the tax address meta only when supported', async ({ orderCreate, minor }) => {
  vi.spyOn(CatalogueContext, 'useCatalogue').mockReturnValue({
    catalogue: { capabilities: { orderCreate } } as Catalogue, products, status: 'ready',
  });
  // connector 4.x reads /site once; answer as stock WCPOS 1.10.20.
  const fetchStub = vi.fn<typeof fetch>(async input => String(input).endsWith('/site') ? Response.json({ wcpos_version: '1.10.20' }) : Response.json({
    document: { id: 115, status: 'completed', total: (minor / 100).toFixed(6) }, currentRevision: 'r1',
  }, { status: 201 }));
  vi.stubGlobal('fetch', fetchStub);
  const posts = () => fetchStub.mock.calls.filter(([, init]) => init?.method === 'POST');
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
  expect(posts()).toHaveLength(1);
  const { payload } = JSON.parse(posts()[0][1]!.body as string);
  if (orderCreate === 8) {
    expect(payload.meta_data).toContainEqual({ key: '_woocommerce_pos_tax_based_on', value: 'billing' });
    expect(payload.billing.country).toBe('GB');
  } else {
    expect(payload.meta_data).not.toContainEqual(expect.objectContaining({ key: '_woocommerce_pos_tax_based_on' }));
  }
}, 20_000);

// Money suspect S2: tax-inclusive 12.00, base GB VAT 20%, customer billing US-CA at CA Tax 10%, order.create 8.
// The till splits 12.00 at the customer's 10% (@tallyui/pos woocommerceLine): net 10.909091 + tax 1.090909 = 12.00.
// WooCommerce's web price (woocommerce_adjust_non_base_location_prices) would be 12.00 / 1.2 × 1.1 = 11.00.
test('order.create 8 with inclusive prices and a non-base customer rate keeps the store total', async () => {
  const inclusive: StoreSettings = {
    ...taxed, pricesIncludeTax: true, taxRounding: { granularity: 'woocommerce', roundAtSubtotal: false },
    baseTaxAddress: { country: 'GB', state: '', city: '', postcode: '' }, taxRatesPpm: { default: 200000 },
    taxRates: { standard: [{ id: 2, code: 'GB-VAT-1', label: 'VAT', rate: '20.0000', priority: 1, compound: false, shipping: true }] },
  };
  const usCustomer = { id: '8', name: 'Bo Cruz', billing: { country: 'US', state: 'CA', city: 'Fresno', postcode: '93650' } };
  const priced = products.map(p => p.name === 'Espresso' ? { ...p, price: '12.00', regular_price: '12.00' } : p);
  vi.spyOn(CatalogueContext, 'useCatalogue').mockReturnValue({
    catalogue: { capabilities: { orderCreate: 8 } } as Catalogue, products: priced, status: 'ready',
  });
  const fetchStub = vi.fn<typeof fetch>(async input => String(input).endsWith('/site') ? Response.json({ wcpos_version: '1.10.20' }) : Response.json({
    document: { id: 117, status: 'completed', total: '12.000000' }, currentRevision: 'r1',
  }, { status: 201 }));
  vi.stubGlobal('fetch', fetchStub);
  render(
    <SessionProvider>
      <OutboxProvider storage={getRxStorageMemory()}>
        <OrderStoreReady />
        <SaleScreen {...saleProps} products={priced} storeSettings={inclusive} capabilities={{ orderCreate: 8 }} defaultCustomer={usCustomer} />
        <PortalHost />
      </OutboxProvider>
    </SessionProvider>,
  );
  await screen.findByText('Order store ready');
  fireEvent.click(screen.getByText('Espresso'));
  // (a) The store keeps 12.00. The forward keeps the posted line total (woocommerce/includes/rest-api/Controllers/
  // Version2/class-wc-rest-orders-v2-controller.php:1010 overrides the adjusted wc_get_price_excluding_tax at :999,
  // the only place woocommerce_adjust_non_base_location_prices could apply), then calculate_totals (:828) recomputes
  // the line tax on that net at the billing rate (woocommerce-pos/includes/Orders.php:755-759 via the
  // _woocommerce_pos_tax_based_on meta; created_via restored at woocommerce-pos/includes/API/V2/Writers/Order_Writer.php:261-268;
  // woocommerce/includes/class-wc-order-item.php:289): 10.909091 × 10% = 1.09 (abstract-wc-order.php:2282), and
  // abstract-wc-order.php:2436 sets total = round(10.91 + 1.09, 2) = 12.00.
  const storeTotal = '$12.00';
  expect(screen.getByTestId('cart-checkout').textContent).toBe(`Checkout ${storeTotal}`);
  fireEvent.click(screen.getByTestId('cart-checkout'));
  await takeCash(1200);
  await screen.findByTestId('receipt-order');
  await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
  const posts = fetchStub.mock.calls.filter(([, init]) => init?.method === 'POST');
  expect(posts).toHaveLength(1);
  const { payload } = JSON.parse(posts[0][1]!.body as string);
  expect(payload.meta_data).toContainEqual({ key: '_woocommerce_pos_tax_based_on', value: 'billing' });
  expect(payload.billing).toMatchObject({ country: 'US', state: 'CA' });
  // (b) The server keeps the posted net; it never takes a line tax from the till (none is sent) and recomputes it.
  expect(payload.line_items).toHaveLength(1);
  expect(payload.line_items[0]).toMatchObject({ product_id: 80, quantity: 1, subtotal: '10.909091', total: '10.909091' });
  expect(payload.line_items[0]).not.toHaveProperty('taxes');
  expect(payload.line_items[0]).not.toHaveProperty('total_tax');
}, 20_000);

// #623 (b): the parked cart keeps the customer's addresses, so a resumed sale is taxed and sent as it was parked.
test.each(['the open orders list', 'a cashier switch'])('a sale parked and resumed through %s keeps its tax address', async path => {
  vi.spyOn(CatalogueContext, 'useCatalogue').mockReturnValue({
    catalogue: { capabilities: { orderCreate: 8 } } as Catalogue, products, status: 'ready',
  });
  const fetchStub = vi.fn<typeof fetch>(async input => String(input).endsWith('/site') ? Response.json({ wcpos_version: '1.10.20' }) : Response.json({
    document: { id: 116, status: 'completed', total: '3.600000' }, currentRevision: 'r1',
  }, { status: 201 }));
  vi.stubGlobal('fetch', fetchStub);
  const db = await createRxDatabase({ name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }) });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const customers = { search: vi.fn().mockResolvedValue([{ ...customer, email: 'ann@example.invalid' }]), create: vi.fn() };
    const storage = getRxStorageMemory();
    const tree = (key: string) => <SessionProvider><OutboxProvider storage={storage}><OrderStoreReady />
      <SaleScreen key={key} {...saleProps} storeSettings={taxed} capabilities={{ orderCreate: 8 }} customers={customers}
        parkedCarts={parkedCarts} heldCartKey="held-test" cashiers={[{ uuid: 'b', name: 'Sam' }]} onSwitchCashier={async () => null} />
      <PortalHost /></OutboxProvider></SessionProvider>;
    const view = render(tree('first'));
    await screen.findByText('Order store ready');
    fireEvent.click(screen.getByTestId('cart-customer-name'));
    fireEvent.click(await screen.findByLabelText('Ann Lee, ann@example.invalid'));
    fireEvent.click(screen.getByText('Espresso'));
    expect(screen.getByTestId('cart-checkout').textContent).toBe('Checkout $3.60');
    if (path === 'a cashier switch') {
      fireEvent.click(screen.getByTestId('register-bar-avatar'));
      fireEvent.click(screen.getByTestId('user-sheet-user-b'));
      fireEvent.click(screen.getByTestId('switch-confirm-confirm'));
      await waitFor(() => expect(localStorage.getItem('held-test')).not.toBeNull());
      // The next cashier's screen mounts and takes the held cart back.
      view.rerender(tree('second'));
    } else {
      await act(async () => { fireEvent.click(screen.getByTestId('new-order-tab')); });
      await waitFor(() => expect(parkedTabs()).toHaveLength(1));
      await resumeFromList();
    }
    // Before #623 the resumed sale was taxed on the CA base: 3.00 + 0.30 = $3.30.
    await waitFor(() => expect(screen.getByTestId('cart-checkout').textContent).toBe('Checkout $3.60'));
    expect(await parkedCarts.find().exec()).toEqual([]);
    fireEvent.click(screen.getByTestId('cart-checkout'));
    await takeCash(360);
    await screen.findByTestId('receipt-order');
    await waitFor(() => expect(screen.queryByTestId('sync-status')).toBeNull());
    const posts = fetchStub.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(1);
    const { payload } = JSON.parse(posts[0][1]!.body as string);
    // The envelope's taxAddress goes out as this meta, with the customer's billing address (connector toWooOrderPayload).
    expect(payload.meta_data).toContainEqual({ key: '_woocommerce_pos_tax_based_on', value: 'billing' });
    expect(payload.billing).toEqual({ email: 'ann@example.invalid', country: 'GB', city: 'London', postcode: 'N1 1AA' });
  } finally { cleanup(); await db.remove(); }
}, 30_000);
