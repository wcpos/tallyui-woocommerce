import { noTaxSettings } from './fixtures/store-settings';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { SaleScreen as SaleScreenWithoutHost } from '../components/sale-screen';
import { PortalHost } from '@tallyui/primitives';
import type { SaleScreenProps } from '../components/sale-screen';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { cartTabCount, openCartTab } from './phone-tabs-helpers';

function SaleScreen(props: SaleScreenProps) {
  return <><SaleScreenWithoutHost {...props} /><PortalHost /></>;
}

const attributes = [
  { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
  { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
];
const docs = variations.documents.filter(doc => doc.parent_id === products[2].id)
  .map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }));
const shirt = { ...products[2], attributes, variation_docs: docs };

const props: SaleScreenProps = {
  storeSettings: noTaxSettings,
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', cashierRef: '2',
  status: 'ready', onSignOut: () => {},
};

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
});

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => {
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open(items: unknown[] = [shirt]) {
  render(<SaleScreen {...props} products={items} />);
  fireEvent.click(screen.getByText('T-Shirt'));
}

function pick(value: string) {
  fireEvent.click(screen.getByText(value));
}

function addAndOpenCart() {
  fireEvent.click(screen.getByTestId('variation-popover-add-to-cart'));
  openCartTab();
}

test('a variable product opens the picker with its groups and no Add before one variation matches', () => {
  open();
  expect(screen.getByTestId('variation-picker')).not.toBeNull();
  for (const text of ['Size', 'Colour', 'S', 'M', 'Black', 'White']) expect(screen.getByText(text)).not.toBeNull();
  expect(screen.queryByText('Choose an option')).toBeNull();
  expect(screen.queryByTestId('variation-popover-add-to-cart')).toBeNull();
  expect(screen.queryByTestId('variation-popover-unavailable')).toBeNull();
  expect(cartTabCount()).toBe('New');
});

test('picking M finds the one match and adds it with its price', () => {
  open();
  pick('M');
  expect(screen.getByTestId('variation-popover-stock-badge').textContent).toBe('10 in stock');
  expect(screen.getByTestId('variation-popover-add-to-cart').textContent).toBe('Add to Cart: $25.00');
  fireEvent.click(screen.getByTestId('variation-popover-add-to-cart'));
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  openCartTab();
  expect(screen.getByText('T-Shirt · M / Black')).not.toBeNull();
});

test('two picks narrow to S / White', () => {
  open();
  pick('S');
  expect(screen.queryByTestId('variation-popover-add-to-cart')).toBeNull();
  pick('White');
  addAndOpenCart();
  expect(screen.getByText('T-Shirt · S / White')).not.toBeNull();
});

test('an impossible combination says Variant not available', () => {
  open();
  pick('M');
  pick('White');
  expect(screen.getByTestId('variation-popover-unavailable').textContent).toBe('Variant not available');
  expect(screen.queryByTestId('variation-popover-add-to-cart')).toBeNull();
});

test('changing a choice drops the colour that was only auto-selected', () => {
  open();
  pick('M');
  pick('S');
  // Two S variations match, and Black was never the cashier's choice.
  expect(screen.queryByTestId('variation-popover-add-to-cart')).toBeNull();
});

test('an out-of-stock match says Out of Stock and still adds', () => {
  open([{ ...shirt, variation_docs: docs.map(doc => doc.id === 106 ? { ...doc, stock_status: 'outofstock', stock_quantity: 0 } : doc) }]);
  pick('M');
  expect(screen.getByTestId('variation-popover-stock-badge').textContent).toBe('Out of Stock');
  fireEvent.click(screen.getByTestId('variation-popover-add-to-cart'));
  expect(cartTabCount()).toBe('1');
});

test('an Any colour variation carries the picked colour on the cart line', () => {
  open([{ ...shirt, variation_docs: [{ ...docs[0], id: 110, sku: 'MER-TEE-S', barcode: undefined, global_unique_id: '',
    attributes: [{ id: 0, name: 'Size', slug: 'size', option: 'S' }] }, docs[2]] }]);
  pick('S');
  expect(screen.getByTestId('variation-popover-add-to-cart')).not.toBeNull();
  pick('White');
  addAndOpenCart();
  expect(screen.getByText('T-Shirt · S')).not.toBeNull();
  expect(screen.getByText('Size: S · Colour: White')).not.toBeNull();
});

test('Cancel closes the picker and adds nothing', () => {
  open();
  pick('M');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  expect(screen.getByText('T-Shirt')).not.toBeNull();
  expect(cartTabCount()).toBe('New');
});
