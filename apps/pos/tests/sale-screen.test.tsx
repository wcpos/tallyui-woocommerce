import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createRxDatabase } from 'rxdb';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { catalogueEntries, TaxProvider, useSale } from '@tallyui/pos';
import { SaleScreen } from '../components/sale-screen';
import { PriceEdit } from '../components/price-edit';
import type { SaleScreenProps } from '../components/sale-screen';
import { parkedCartSchema, type ParkedCartCollection } from '../lib/sale/parked-carts';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';

const shirt = { ...products[2], variation_docs: variations.documents.filter(doc => doc.parent_id === products[2].id).map(doc => doc.payload) };

const props: SaleScreenProps = {
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
  fireEvent.click(screen.getByRole('button', { name: 'Edit price' }));
  expect(screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Espresso · $3.00' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'New price (USD)' }), { target: { value: '2.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
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
  fireEvent.click(screen.getByRole('button', { name: 'Edit price' }));
  fireEvent.click(screen.getByRole('button', { name: 'Espresso · $3.00' }));
  for (const value of ['abc', '', '-1.50', '1.2.3', '2.501', '1e2', '9007199254740992']) {
    fireEvent.change(screen.getByRole('textbox', { name: 'New price (USD)' }), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter a valid price');
    expect(screen.getByRole('button', { name: 'Espresso · $3.00' })).not.toBeNull();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('textbox')).toBeNull();
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
}, 20_000);

test('Edit price is only shown when the cart has lines', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.queryByRole('button', { name: 'Edit price' })).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  expect(screen.getByRole('button', { name: 'Edit price' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Espresso' }));
  expect(screen.queryByRole('button', { name: 'Edit price' })).toBeNull();
});

test.each([['JPY', '250', '¥250', '¥500'], ['KWD', '2.501', 'KWD 2.501', 'KWD 5.002']])(
  'price edits use the minor exponent for %s', (currency, value, unit, total) => {
    vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
    render(<SaleScreen {...props} currency={currency} />);
    fireEvent.click(screen.getByText('Espresso'));
    fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit price' }));
    fireEvent.click(screen.getByRole('button', { name: /Espresso ·/ }));
    fireEvent.change(screen.getByRole('textbox', { name: `New price (${currency})` }), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText(`${unit} × 2`)).not.toBeNull();
    expect(within(screen.getByText('Subtotal').parentElement!).getByText(total)).not.toBeNull();
  },
);

test('a real setUnitPrice refusal stays inline without closing the form', () => {
  const { result } = renderHook(() => useSale({ currency: 'USD' }, { registerId: 'web', cashierRef: '2' }), {
    wrapper: ({ children }) => <TaxProvider ratesPpm={{}} pricesIncludeTax={false}>{children}</TaxProvider>,
  });
  act(() => result.current.add(catalogueEntries([products[0]], props.connector.traits.product, { currency: 'USD' })[0], props.connector.traits.product));
  const lines = result.current.order.lineItems;
  act(() => result.current.newSale());
  const onClose = vi.fn();
  render(<PriceEdit lines={lines} currency="USD" onSave={result.current.setUnitPrice} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Espresso · $3.00' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'New price (USD)' }), { target: { value: '2.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByRole('alert').textContent).toBe(`Unknown line ${lines[0].id}`);
  expect(onClose).not.toHaveBeenCalled();
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

test('Cash shows the payment placeholder and Back to cart preserves the cart', () => {
  render(<SaleScreen {...props} />);
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
test('wide: parks, opens while parking the current cart, and deletes', () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  render(<SaleScreen {...props} />);
  expect(screen.getByRole('button', { name: 'Park cart' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Increase Espresso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  expect(screen.getByText('Parked carts')).not.toBeNull();
  expect(screen.getByText('2 items · $6.00')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByText('Cold Brew'));
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.queryByText('Parked carts')).toBeNull();
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
  expect(within(screen.getByText('Subtotal').parentElement!).getByText('$6.00')).not.toBeNull();
  expect(screen.queryByRole('button', { name: 'Remove Cold Brew' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  expect(screen.getByText('1 item · $4.00')).not.toBeNull();
  expect(screen.queryByText('2 items · $6.00')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByText('No parked carts')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Parked (0)' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByText('$3.00 × 2')).not.toBeNull();
}, 20_000);

test('narrow: the parked list opens and restores within the full-screen cart', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));
  expect(screen.getByRole('button', { name: 'Cart is empty' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  expect(screen.getByText('1 item · $3.00')).not.toBeNull();
  expect(screen.queryByPlaceholderText('Search name, SKU or barcode')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Parked (0)' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to products' }));
  expect(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' })).not.toBeNull();
});

test('opening reports a missing product in the phone cart message line', () => {
  const view = render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('Espresso'));
  fireEvent.click(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' }));
  fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
  view.rerender(<SaleScreen {...props} products={products.slice(1)} />);
  fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByText('Espresso is no longer in the catalogue.')).not.toBeNull();
  expect(screen.getByText('Scan or tap a product to start a sale.')).not.toBeNull();
});

test('persisted carts survive a new screen, restore, swap and delete', async () => {
  vi.mocked(ReactNative.useWindowDimensions).mockReturnValue({ width: 900, height: 800, scale: 1, fontScale: 1 });
  const db = await createRxDatabase({
    name: `parked_${crypto.randomUUID()}`, multiInstance: false,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
  });
  try {
    const { parked_carts: parkedCarts } = await db.addCollections<{ parked_carts: ParkedCartCollection }>({
      parked_carts: { schema: parkedCartSchema },
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
    expect(screen.getByText('2 items · $6.00')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByText('$3.00 × 2');
    expect(await parkedCarts.find().exec()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Remove Espresso' })).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Park cart' }));
    await screen.findByRole('button', { name: 'Parked (1)' });
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Espresso' })).toBeNull());
    fireEvent.click(screen.getByText('Cold Brew'));
    fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByText('$3.00 × 2');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Parked (1)' })).not.toBeNull());
    const swapped = await parkedCarts.find().exec();
    expect(swapped).toHaveLength(1);
    expect(swapped[0].toJSON()).toMatchObject({ itemCount: 1, totalMinor: 400, lines: [{ name: 'Cold Brew' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Parked (1)' }));
    expect(screen.getByText('1 item · $4.00')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('No parked carts');
    expect(await parkedCarts.find().exec()).toEqual([]);
  } finally {
    cleanup();
    await db.remove();
  }
}, 20_000);
