import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { SaleScreen } from '../components/sale-screen';
import type { SaleScreenProps } from '../components/sale-screen';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

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

test('variable products show a message and add nothing; adding a simple product clears it', () => {
  render(<SaleScreen {...props} />);
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(screen.getByText('Options for T-Shirt are coming soon')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Cart is empty' })).not.toBeNull();
  expect(screen.queryByRole('button', { name: /Open cart/ })).toBeNull();
  fireEvent.click(screen.getByText('Espresso'));
  expect(screen.queryByText('Options for T-Shirt are coming soon')).toBeNull();
  expect(screen.getByRole('button', { name: 'Open cart, 1 item, $3.00' })).not.toBeNull();
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
  expect(screen.getByText('1 items · $4.00')).not.toBeNull();
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
  expect(screen.getByText('1 items · $3.00')).not.toBeNull();
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
