import { noTaxSettings } from './fixtures/store-settings';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { addRxPlugin, createRxDatabase } from 'rxdb';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { Cart } from '@tallyui/components';
import * as TallyComponents from '@tallyui/components';
import { catalogueEntries, TaxProvider, useSale } from '@tallyui/pos';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import type { SaleScreenProps } from '../components/sale-screen';
import { parkedCartSchema, parkedCartMigrationStrategies, type ParkedCartCollection } from '../lib/sale/parked-carts';
import { SessionProvider } from '../lib/auth/session-context';
import { saveSession } from '../lib/auth/session';
import { OutboxProvider } from '../lib/sale/outbox-context';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

addRxPlugin(RxDBMigrationSchemaPlugin);

const shirt = { ...products[2], variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id).map(doc => doc.payload) };

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('narrow: adds, opens, changes quantity, removes and returns to products', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  const bar = screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' });
  expect(within(bar).getByText('Cart · 1 item')).not.toBeNull();
  fireEvent.click(bar);
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.queryByPlaceholderText('Search name, SKU or barcode')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Espresso' }));
  expect(screen.queryByText('Espresso')).toBeNull();
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));
  expect(screen.getByPlaceholderText('Search name, SKU or barcode')).not.toBeNull();
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Cart is empty' })).not.toBeNull();
});

test('variable products without options add nothing; adding a simple product clears the message', () => {
  render(<SaleScreen {...props} products={[products[0], { ...shirt, variation_docs: [] }]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(screen.getByText('T-Shirt has no options to sell')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Cart is empty' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: /Open cart/ })).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  expect(screen.queryByText('T-Shirt has no options to sell')).toBeNull();
  expect(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' })).not.toBeNull();
});

test.each([600, 900])('variants at %spx: lists synced titles, prices and stock, then adds the selected variant', width => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} products={[shirt]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  for (const title of ['S / Black', 'S / White', 'M / Black']) {
    const option = screen.getByRole('button', { name: new RegExp(title) });
    expect(within(option).getByText(title)).not.toBeNull();
    expect(within(option).getByText('$25.00')).not.toBeNull();
    expect(within(option).getByText('In stock · 10')).not.toBeNull();
  }
  fireEvent.click(screen.getByRole('button', { name: /M \/ Black/ }));
  expect(screen.queryByText('Choose an option')).toBeNull();
  if (width < 900) fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $25.00' }));
  expect(screen.getByText('T-Shirt · M / Black')).not.toBeNull();
  expect(screen.getByText('$25.00 × 1')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$25.00')).not.toBeNull();
});

test('one purchasable variant adds immediately', () => {
  render(<SaleScreen {...props} products={[{ ...shirt, variation_docs: shirt.variation_docs.slice(2) }]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(screen.queryByText('Choose an option')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $25.00' }));
  expect(screen.getByText('T-Shirt · M / Black')).not.toBeNull();
});

test('cancelling the variant chooser adds nothing', () => {
  render(<SaleScreen {...props} products={[shirt]} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('T-Shirt')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Cart is empty' })).not.toBeNull();
});

test('editing Espresso ×2 changes the unit price and subtotal exactly', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByText('Price', { exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Price value' }), { target: { value: '2.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText('$2.50 × 2')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$5.00')).not.toBeNull();
  expect(within(screen.getByText('Total').parentElement!).getByText('$5.00')).not.toBeNull();
});

test('invalid prices leave the form open and Cancel preserves the original price and total', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByText('Price', { exact: true }));
  for (const [value, message] of [
    ['', 'Enter a price.'], ['abc', 'Enter a number.'], ['-1', 'Enter a price of 0 or more.'],
    ['1.2.3', 'Enter a number.'], ['2.501', 'Use at most 2 decimal places.'],
    ['1e2', 'Enter a number.'], ['9007199254740992', 'Enter a number.'],
  ]) {
    fireEvent.change(screen.getByRole('textbox', { name: 'Price value' }), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.getByRole('group', { name: 'Price for Espresso' })).not.toBeNull();
    expect(screen.getByText('$3.00 × 2')).not.toBeNull();
    expect(within(screen.getByText('Total').parentElement!).getByText('$6.00')).not.toBeNull();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
  expect(within(screen.getByText('Total').parentElement!).getByText('$6.00')).not.toBeNull();
}, 20_000);

test('parks through the sheet, shows the parked customer and restores them to the cart', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const gee = { id: '7', name: 'Gee Four', email: 'gee@example.invalid' };
  const customers = { search: vi.fn().mockResolvedValue([gee]), create: vi.fn().mockResolvedValue(gee) };
  render(<SaleScreen {...props} customers={customers} />);
  fireEvent.click(screen.getByRole('button', { name: 'Change customer' }));
  fireEvent.change(screen.getByPlaceholderText('Search name, email or phone'), { target: { value: 'gee' } });
  fireEvent.click(await screen.findByLabelText('Gee Four, gee@example.invalid'));
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Parked (0)' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Park this sale' })); });
  const sheet = within(screen.getByTestId('parked-sales'));
  expect(sheet.getByText('Gee Four')).not.toBeNull();
  expect(sheet.getByText('1 item')).not.toBeNull();
  expect(sheet.getByText('$3.00')).not.toBeNull();
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(await screen.findByText('Customer: Gee Four')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();
});

test('Price actions appear once per line and none appear with an empty cart', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.queryByText('Price', { exact: true })).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  expect(screen.getAllByText('Price', { exact: true })).toHaveLength(1);
  fireEvent.click(screen.getByText('Cold Brew'));
  expect(screen.getAllByText('Price', { exact: true })).toHaveLength(2);
  fireEvent.click(screen.getAllByText('Price', { exact: true })[1]);
  expect(screen.getByRole('group', { name: 'Price for Cold Brew' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Cold Brew' }));
  expect(screen.getAllByText('Price', { exact: true })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Espresso' }));
  expect(screen.queryByText('Price', { exact: true })).toBeNull();
});

test.each([
  ['JPY', '350', '¥350', '¥700', '350.5', 'Use a whole amount.'],
  ['KWD', '2.501', 'KWD 2.501', 'KWD 5.002', '2.5011', 'Use at most 3 decimal places.'],
])(
  'price edits respect the library decimal limit for %s', (currency, value, unit, total, invalid, message) => {
    vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
    render(<SaleScreen {...props} currency={currency} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
    fireEvent.click(screen.getByText('Price', { exact: true }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Price value' }), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByText(`${unit} × 2`)).not.toBeNull();
    expect(within(screen.getByText('Subtotal').parentElement!).getByText(total)).not.toBeNull();
    fireEvent.click(screen.getByText('Price', { exact: true }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Price value' }), { target: { value: invalid } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.getByRole('group', { name: 'Price for Espresso' })).not.toBeNull();
    expect(screen.getByText(`${unit} × 2`)).not.toBeNull();
    expect(within(screen.getByText('Subtotal').parentElement!).getByText(total)).not.toBeNull();
  },
);

test('a real setUnitPrice refusal stays inline without closing the form', () => {
  const { result } = renderHook(() => useSale({ currency: 'USD' }, { registerId: 'web', cashierRef: '2' }), {
    wrapper: ({ children }) => <TaxProvider ratesPpm={{}} pricesIncludeTax={false}>{children}</TaxProvider>,
  });
  act(() => result.current.add(catalogueEntries([products[0]], props.connector.traits.product, { currency: 'USD' })[0], props.connector.traits.product));
  const sale = result.current;
  act(() => result.current.newSale());
  render(<Cart sale={sale} canEditPrice />);
  fireEvent.click(screen.getByText('Price', { exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Price value' }), { target: { value: '2.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
  const form = screen.getByRole('group', { name: 'Price for Espresso' });
  expect(within(form).getByRole('alert').textContent).toBe(`Unknown line ${sale.order.lineItems[0].id}`);
  expect(within(form).getByRole('textbox', { name: 'Price value' })).not.toBeNull();
  expect(result.current.order.lineItems).toEqual([]);
});

test('wide: the grid and cart render together at 900px and Cold Brew costs $4.00', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.getByPlaceholderText('Search name, SKU or barcode')).not.toBeNull();
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Cart is empty' })).toBeNull();
  fireEvent.click(screen.getByText('Cold Brew'));
  expect(screen.getAllByText('Cold Brew')).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Remove Cold Brew' })).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$4.00')).not.toBeNull();
});

test('with no order transport, Cash shows the payment placeholder and Back to cart keeps the cart', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
  });
  saveSession({
    site: { name: 'Store', home: 'https://shop.example', wpApiUrl: '', wcposApiUrl: '', authUrl: '' },
    tokens: { accessToken: 'test', refreshToken: 'test', expiresAt: 2000000000,
      user: { id: 2, uuid: 'cashier', displayName: 'Paul' } },
  });
  render(<SessionProvider><OutboxProvider transportFor={() => null}><SaleScreen {...props} /></OutboxProvider></SessionProvider>);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cash' }));
  expect(screen.getByText('Taking payment arrives in the next update')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Cash' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to cart' }));
  expect(screen.queryByText('Taking payment arrives in the next update')).toBeNull();
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Cash' })).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$3.00')).not.toBeNull();
});

// Several full renders of the sale screen take longer than 5 s on the CI runner.
test('wide: parks, resumes while parking the current cart, and discards with confirmation', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.getByRole('button', { name: 'Park cart' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  expect(screen.getByText('Parked sales')).not.toBeNull();
  expect(within(screen.getByTestId('parked-sales')).getByText('2 items')).not.toBeNull();
  expect(within(screen.getByTestId('parked-sales')).getByText('$6.00')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  fireEvent.click(screen.getByText('Cold Brew'));
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Cold Brew' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  const sheet = within(screen.getByTestId('parked-sales'));
  expect(sheet.getByText('1 item')).not.toBeNull();
  expect(sheet.getByText('$4.00')).not.toBeNull();
  expect(sheet.queryByText('2 items')).toBeNull();
  fireEvent.click(sheet.getByRole('button', { name: 'Discard parked sale' }));
  expect(sheet.getByText('Discard this parked sale?')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Parked (1)' })).not.toBeNull();
  await act(async () => { fireEvent.click(sheet.getByRole('button', { name: 'Discard' })); });
  expect(sheet.getByText('No parked sales.')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Parked (0)' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
}, 20_000);

test('narrow: the parked sheet opens and restores within the full-screen cart', async () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));
  expect(screen.getByRole('button', { name: 'Cart is empty' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  expect(within(screen.getByTestId('parked-sales')).getByText('1 item')).not.toBeNull();
  expect(within(screen.getByTestId('parked-sales')).getByText('$3.00')).not.toBeNull();
  expect(screen.queryByPlaceholderText('Search name, SKU or barcode')).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Parked (0)' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));
  expect(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' })).not.toBeNull();
});

test('onResume resolves after restoration, and the sheet closes with the restored lines present', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const ParkedSales = TallyComponents.ParkedSales;
  let latest: Parameters<typeof ParkedSales>[0];
  const resumed = vi.fn();
  const closed = vi.fn();
  vi.spyOn(TallyComponents, 'ParkedSales').mockImplementation(sheetProps => {
    latest = sheetProps;
    return <ParkedSales {...sheetProps} onResume={async id => {
      const result = await sheetProps.onResume!(id);
      resumed(result, latest.sale.order.lineItems.map(({ name, quantity }) => ({ name, quantity })));
      return result;
    }} onOpenChange={open => {
      if (!open) closed(open, latest.sale.order.lineItems.map(({ name, quantity }) => ({ name, quantity })),
        !!screen.queryByText('$3.00 × 2'), !!screen.queryByText('$4.00 × 3'));
      sheetProps.onOpenChange(open);
    }} />;
  });
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByText('Cold Brew'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Cold Brew' }));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Cold Brew' }));
  fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await Promise.resolve();
    expect(resumed).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    expect(latest.open).toBe(true);
  });
  const lines = [{ name: 'Espresso', quantity: 2 }, { name: 'Cold Brew', quantity: 3 }];
  expect(resumed).toHaveBeenCalledExactlyOnceWith(null, lines);
  expect(closed).toHaveBeenCalledExactlyOnceWith(false, lines, true, true);
  expect(latest!.open).toBe(false);
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
  expect(screen.getByText('$4.00 × 3')).not.toBeNull();
}, 20_000);

test('resuming reports a missing product in the phone cart message line', async () => {
  const view = render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
  view.rerender(<SaleScreen {...props} products={products.slice(1)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' })); });
  expect(screen.queryByTestId('parked-sales')).toBeNull();
  expect(screen.getByText('Espresso is no longer in the catalogue.')).not.toBeNull();
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
});

test('toolbar park failure shows the error and keeps the cart line', async () => {
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    vi.spyOn(parkedCarts, 'insert').mockRejectedValue(new Error('disk full'));
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
    fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
    expect(await screen.findByText('disk full')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();
    expect(screen.getByText('$3.00 × 1')).not.toBeNull();
  } finally {
    cleanup();
    await db.remove();
  }
});

test('a parked cart stays parked while syncing and resumes once the catalogue is ready', async () => {
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const cart = await parkedCarts.insert({
      id: crypto.randomUUID(), parkedAt: new Date().toISOString(), itemCount: 2, totalMinor: 600,
      lines: [{ productId: '80', variantId: '80', name: 'Espresso', quantity: 2, discounts: [] }], orderDiscounts: [],
    });
    const view = render(<SaleScreen {...props} parkedCarts={parkedCarts} products={[]} status="syncing" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Parked (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    expect(await within(screen.getByTestId('parked-sales')).findByText(
      'The catalogue is still syncing. Try again in a moment.',
    )).not.toBeNull();
    expect((await parkedCarts.find().exec()).map(doc => doc.toJSON())).toEqual([cart.toJSON()]);
    expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();

    view.rerender(<SaleScreen {...props} parkedCarts={parkedCarts} status="ready" />);
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await screen.findByText('$3.00 × 2');
    await waitFor(() => expect(screen.queryByTestId('parked-sales')).toBeNull());
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();
  } finally {
    cleanup();
    await db.remove();
  }
});

test('persisted carts survive a new screen, restore, swap and discard', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema, migrationStrategies: parkedCartMigrationStrategies },
    });
    const view = render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
    await screen.findByRole('button', { name: 'Parked (1)' });
    const docs = await parkedCarts.find().exec();
    expect(docs).toHaveLength(1);
    expect(docs[0].toJSON()).toMatchObject({
      itemCount: 2, totalMinor: 600, lines: [{ productId: '80', name: 'Espresso', quantity: 2 }],
    });
    view.unmount();
    render(<SaleScreen {...props} parkedCarts={parkedCarts} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Parked (1)' }));
    expect(within(screen.getByTestId('parked-sales')).getByText('2 items')).not.toBeNull();
    expect(within(screen.getByTestId('parked-sales')).getByText('$6.00')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await screen.findByText('$3.00 × 2');
    await waitFor(() => expect(screen.queryByTestId('parked-sales')).toBeNull());
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
    await screen.findByRole('button', { name: 'Parked (1)' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull());
    fireEvent.click(screen.getByText('Cold Brew'));
    fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume parked sale' }));
    await screen.findByText('$3.00 × 2');
    await waitFor(() => expect(screen.queryByTestId('parked-sales')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Parked (1)' })).not.toBeNull());
    const swapped = await parkedCarts.find().exec();
    expect(swapped).toHaveLength(1);
    expect(swapped[0].toJSON()).toMatchObject({ itemCount: 1, totalMinor: 400, lines: [{ name: 'Cold Brew' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
    expect(within(screen.getByTestId('parked-sales')).getByText('1 item')).not.toBeNull();
    expect(within(screen.getByTestId('parked-sales')).getByText('$4.00')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Discard parked sale' }));
    expect(screen.getByText('Discard this parked sale?')).not.toBeNull();
    expect(await parkedCarts.find().exec()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await screen.findByText('No parked sales.');
    expect(await parkedCarts.find().exec()).toEqual([]);
  } finally {
    cleanup();
    await db.remove();
  }
}, 20_000);
