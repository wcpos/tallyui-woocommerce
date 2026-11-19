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

// A tap on a product whose variants are all full drills in, in the grid and the table alike
// (catalogue-drill-in.test), so the shirt carries a fourth variant, L in any colour, and opens the picker.
const attributes = [
  { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M', 'L'] },
  { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
];
const fullDocs = variations.documents.filter(doc => doc.parent_id === products[2].id)
  .map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }));
const docs = [...fullDocs, { ...fullDocs[2], id: 107, name: 'L', sku: 'MER-TEE-L', barcode: undefined, global_unique_id: '',
  attributes: [{ id: 0, name: 'Size', slug: 'size', option: 'L' }] }];
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

// Browse by now opens on category tiles, so these tests browse All products, in the table.
beforeEach(() => {
  const data = new Map([[CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all', view: 'table' })]]);
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

// The dev store's Cap (seed.php MER-CAP): one variation, Size Any, Colour Black.
const capVariation = (attrs: { name: string; option: string }[]) => ({ ...docs[0], id: 120, name: 'Cap', sku: 'MER-CAP-ANY-BLK',
  barcode: undefined, global_unique_id: '', attributes: attrs.map(attr => ({ id: 0, slug: attr.name.toLowerCase(), ...attr })) });
const cap = (attrs: { name: string; option: string }[]) => ({ ...shirt, id: 119, name: 'Cap', sku: 'MER-CAP', variations: [120],
  variation_docs: [capVariation(attrs)] });

test('a lone variation that leaves Size open opens the picker and adds nothing yet', () => {
  render(<SaleScreen {...props} products={[cap([{ name: 'Colour', option: 'Black' }])]} />);
  fireEvent.click(screen.getByText('Cap'));
  expect(screen.getByTestId('variation-picker')).not.toBeNull();
  expect(cartTabCount()).toBe('New');
});

test('picking L for the lone Any variation carries Colour: Black · Size: L on the cart line', () => {
  render(<SaleScreen {...props} products={[cap([{ name: 'Colour', option: 'Black' }])]} />);
  fireEvent.click(screen.getByText('Cap'));
  pick('L');
  addAndOpenCart();
  expect(cartTabCount()).toBe('1');
  expect(screen.getByText('Colour: Black · Size: L')).not.toBeNull();
});

test('a lone variation that sets every attribute still adds in one tap', () => {
  render(<SaleScreen {...props} products={[cap([{ name: 'Size', option: 'L' }, { name: 'Colour', option: 'Black' }])]} />);
  fireEvent.click(screen.getByText('Cap'));
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  expect(cartTabCount()).toBe('1');
});

test('Cancel closes the picker and adds nothing', () => {
  open();
  pick('M');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  expect(screen.getByText('T-Shirt')).not.toBeNull();
  expect(cartTabCount()).toBe('New');
});

// v2's characterCount rule: the colours below total 15 or more characters, so Colour is a select.
const longName: Record<string, string> = { Black: 'Midnight Black', White: 'Arctic White' };
const longShirt = {
  ...shirt,
  attributes: [attributes[0], { ...attributes[1], options: ['Midnight Black', 'Arctic White'] }],
  variation_docs: docs.map(doc => ({ ...doc, attributes: doc.attributes.map(attr =>
    attr.name === 'Colour' ? { ...attr, option: longName[attr.option] } : attr) })),
};
// Over 10 values: a searchable combobox. Red and the rest have no variation, so they are unavailable.
const manyShirt = { ...shirt, attributes: [attributes[0], { ...attributes[1],
  options: ['Black', 'White', 'Red', 'Green', 'Blue', 'Yellow', 'Purple', 'Orange', 'Pink', 'Brown', 'Grey'] }] };

function search(text: string) {
  fireEvent.change(screen.getByTestId('variation-combobox-search'), { target: { value: text } });
}

test('long values are a Select an option select, and picking one chooses it as the buttons do', () => {
  open([longShirt]);
  expect(screen.getByTestId('variation-select-Colour').textContent).toBe('Select an option');
  expect(screen.queryByText('Midnight Black')).toBeNull();
  expect(screen.getByText('S')).not.toBeNull();
  fireEvent.click(screen.getByTestId('variation-select-Colour'));
  fireEvent.click(screen.getByTestId('variation-option-Arctic White'));
  expect(screen.getByTestId('variation-select-Colour').textContent).toBe('Arctic White');
  pick('S');
  addAndOpenCart();
  expect(screen.getByText('T-Shirt · S / Arctic White')).not.toBeNull();
});

test('more than 10 values are a searchable combobox with Search Variations and No variation found', () => {
  open([manyShirt]);
  expect(screen.queryByTestId('variation-select-Colour')).toBeNull();
  expect(screen.getByTestId('variation-combobox-Colour').textContent).toBe('Select an option');
  fireEvent.click(screen.getByTestId('variation-combobox-Colour'));
  expect(screen.getByTestId('variation-combobox-search').getAttribute('placeholder')).toBe('Search Variations');
  search('whi');
  expect(screen.getByTestId('variation-option-White')).not.toBeNull();
  expect(screen.queryByTestId('variation-option-Black')).toBeNull();
  expect(screen.queryByText('No variation found')).toBeNull();
  search('zzz');
  expect(screen.queryByTestId('variation-option-White')).toBeNull();
  expect(screen.getByTestId('variation-combobox-empty').textContent).toBe('No variation found');
  search('whi');
  fireEvent.click(screen.getByTestId('variation-option-White'));
  expect(screen.queryByTestId('variation-combobox-search')).toBeNull();
  expect(screen.getByTestId('variation-combobox-Colour').textContent).toBe('White');
  pick('S');
  addAndOpenCart();
  expect(screen.getByText('T-Shirt · S / White')).not.toBeNull();
});

test('short values keep the buttons', () => {
  open();
  expect(screen.queryByText('Select an option')).toBeNull();
  for (const name of ['Size', 'Colour']) {
    expect(screen.queryByTestId(`variation-select-${name}`)).toBeNull();
    expect(screen.queryByTestId(`variation-combobox-${name}`)).toBeNull();
  }
  for (const text of ['Black', 'White']) expect(screen.getByText(text)).not.toBeNull();
});

test('unavailable values are disabled in the select and the combobox', () => {
  open([longShirt]);
  pick('M');
  expect(screen.getByTestId('variation-select-Colour').textContent).toBe('Midnight Black');
  fireEvent.click(screen.getByTestId('variation-select-Colour'));
  expect(screen.getByTestId('variation-option-Arctic White').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('variation-option-Midnight Black').getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(screen.getByTestId('variation-option-Arctic White'));
  expect(screen.getByTestId('variation-select-Colour').textContent).toBe('Midnight Black');
  expect(screen.queryByTestId('variation-popover-unavailable')).toBeNull();
  cleanup();

  // L takes any colour, so Red is only unavailable once the size is S.
  open([manyShirt]);
  pick('S');
  fireEvent.click(screen.getByTestId('variation-combobox-Colour'));
  expect(screen.getByTestId('variation-option-Red').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('variation-option-White').getAttribute('aria-disabled')).toBeNull();
  fireEvent.click(screen.getByTestId('variation-option-Red'));
  expect(screen.getByTestId('variation-combobox-Colour').textContent).toBe('Select an option');
});
