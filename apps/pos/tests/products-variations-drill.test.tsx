import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { ProductsScreen } from '../components/products-screen';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

// v2's Products page in its default 'drill' style (WCPOS monorepo packages/core/src/screens/main/products/products.tsx,
// drill.test.tsx, components/product/attributes.tsx): the attribute links and "N variations ›" drill into the product.

const connector = createWooCommerceConnector();
const [espresso, coldBrew] = products;
// The T-Shirt's attributes as the connector syncs them, plus one that is not used for variations.
const attributes = [
  { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
  { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
  { id: 0, name: 'Fabric', position: 2, visible: true, variation: false, options: ['Cotton'] },
];
// 104 S/Black, 105 S/White, 106 M/Black; 105 is sold out here.
const docs = variations.documents.map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }))
  .map(doc => doc.id === 105 ? { ...doc, stock_quantity: 0 } : doc);
const shirt = { ...products[2], attributes, variation_docs: docs };
const catalogue = [espresso, coldBrew, shirt];

function setWidth(width: number) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

beforeEach(() => { setWidth(1000); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderScreen(items: any[] = catalogue) {
  return render(<ProductsScreen products={items} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} />,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
}

const rowIds = (prefix = 'product-row-') => screen.queryAllByTestId(new RegExp(`^${prefix}\\d+$`))
  .map(el => Number(el.getAttribute('data-testid')!.slice(prefix.length)));
const text = (testID: string) => screen.getByTestId(testID).textContent;
const crumb = () => screen.queryByTestId('products-breadcrumb');

test('a variable product shows its variation attributes with the options as links, and "N variations" as a button with a chevron after it; a simple product neither', () => {
  renderScreen();
  expect(text(`product-attributes-${shirt.id}-Size`)).toBe('Size: S, M');
  expect(text(`product-attributes-${shirt.id}-Colour`)).toBe('Colour: Black, White');
  for (const option of ['S', 'M']) {
    expect(screen.getByTestId(`product-attribute-${shirt.id}-Size-${option}`).getAttribute('role')).toBe('link');
  }
  const button = screen.getByTestId('variable-product-expand');
  expect(button.getAttribute('role')).toBe('button');
  expect(text(`product-variations-${shirt.id}`)).toBe('6 variations');
  const label = screen.getByTestId(`product-variations-${shirt.id}`);
  const chevron = screen.getByTestId(`product-variations-chevron-${shirt.id}`);
  expect(button.contains(label) && button.contains(chevron)).toBe(true);
  expect(label.compareDocumentPosition(chevron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  for (const simple of [espresso, coldBrew]) {
    expect(screen.queryByTestId(`product-variations-${simple.id}`)).toBeNull();
    expect(screen.queryAllByTestId(new RegExp(`^product-attributes?-${simple.id}-`))).toHaveLength(0);
  }
  expect(screen.getAllByTestId('variable-product-expand')).toHaveLength(1);
});

test('a non-variation attribute is not drawn', () => {
  renderScreen();
  expect(screen.queryByTestId(`product-attributes-${shirt.id}-Fabric`)).toBeNull();
  expect(screen.queryByTestId(`product-attribute-${shirt.id}-Fabric-Cotton`)).toBeNull();
  expect(screen.queryByText(/Fabric/)).toBeNull();
});

test('"N variations" drills in: the crumb, the product\'s variations on their own card and no other product; the crumb\'s Products goes back to the full list', () => {
  renderScreen();
  expect(crumb()).toBeNull();
  expect(rowIds()).toEqual([coldBrew.id, espresso.id, shirt.id]);
  fireEvent.click(screen.getByTestId(`product-variations-${shirt.id}`));
  expect(text('products-breadcrumb-back')).toBe('Products');
  expect(text('products-breadcrumb-here')).toBe('T-Shirt');
  const surface = screen.getByTestId('products-variations-surface');
  expect(screen.queryByTestId('products-table-surface')).toBeNull();
  expect(rowIds()).toEqual([104, 105, 106]);
  expect(rowIds().every(id => surface.contains(screen.getByTestId(`product-row-${id}`)))).toBe(true);
  // v2's ProductVariationName, then the variation's own price and stock; the head row is the table's labels.
  expect(text('product-variation-name-104')).toBe('S, Black');
  expect(text('product-variation-name-106')).toBe('M, Black');
  expect(text('product-price-106')).toBe('$25.00');
  expect(text('product-stock-quantity-104')).toBe('10');
  expect(text('product-stock-status-105')).toBe('Out of Stock');
  expect(within(surface).getAllByRole('columnheader').map(header => header.textContent))
    .toEqual(['Image', 'Product', 'Stock', 'Stock Status', 'Categories', 'Price', 'Regular Price', 'Sale Price']);
  expect(text('data-table-count')).toBe('Showing 3 of 6');
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  expect(crumb()).toBeNull();
  expect(screen.queryByTestId('products-variations-surface')).toBeNull();
  expect(rowIds()).toEqual([coldBrew.id, espresso.id, shirt.id]);
  expect(text('data-table-count')).toBe('Showing 3 of 3');
});

test('an option drills in with only the variations that match it; its chip clears the match', () => {
  renderScreen();
  fireEvent.click(screen.getByTestId(`product-attribute-${shirt.id}-Colour-White`));
  expect(text('products-breadcrumb-here')).toBe('T-Shirt');
  expect(rowIds()).toEqual([105]);
  expect(text('products-variation-match')).toBe('Colour: White ×');
  fireEvent.click(screen.getByTestId('products-variation-match'));
  expect(rowIds()).toEqual([104, 105, 106]);
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  // Reopened from another option, the drill starts afresh with that option.
  fireEvent.click(screen.getByTestId(`product-attribute-${shirt.id}-Size-M`));
  expect(rowIds()).toEqual([106]);
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  fireEvent.click(screen.getByTestId(`product-attribute-${shirt.id}-Size-S`));
  expect(rowIds()).toEqual([104, 105]);
});

test('a variation that leaves the attribute open ("Any") matches every option of it', () => {
  const anyColour = { ...shirt, variation_docs: [...docs, { ...docs[0], id: 107, attributes: [{ name: 'Size', option: 'M' }] }] };
  renderScreen([anyColour]);
  fireEvent.click(screen.getByTestId(`product-attribute-${shirt.id}-Colour-White`));
  expect(rowIds()).toEqual([105, 107]);
});

test('the Stock Status chip applies to the variations while drilled', () => {
  renderScreen();
  fireEvent.click(screen.getByTestId(`product-variations-${shirt.id}`));
  fireEvent.click(screen.getByTestId('filter-pill-stock_status'));
  fireEvent.click(screen.getByTestId('stock-status-option-outofstock'));
  expect(crumb()).not.toBeNull();
  expect(rowIds()).toEqual([105]);
});

test('a search change drops the drill, and clearing the search does not bring it back', async () => {
  renderScreen();
  fireEvent.click(screen.getByTestId(`product-variations-${shirt.id}`));
  expect(crumb()).not.toBeNull();
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'shirt' } });
  await waitFor(() => expect(crumb()).toBeNull());
  expect(rowIds()).toEqual([shirt.id]);
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: '' } });
  await waitFor(() => expect(rowIds()).toEqual([coldBrew.id, espresso.id, shirt.id]));
  expect(crumb()).toBeNull();
});

test('at phone width the list gets the same links and drill', () => {
  setWidth(400);
  renderScreen();
  expect(text(`product-attributes-${shirt.id}-Size`)).toBe('Size: S, M');
  expect(rowIds('products-row-')).toEqual([coldBrew.id, espresso.id, shirt.id]);
  fireEvent.click(screen.getByTestId(`product-variations-${shirt.id}`));
  expect(text('products-breadcrumb-here')).toBe('T-Shirt');
  expect(rowIds('products-row-')).toEqual([104, 105, 106]);
  expect(text('product-variation-name-105')).toBe('S, White');
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  fireEvent.click(screen.getByTestId(`product-attribute-${shirt.id}-Size-M`));
  expect(rowIds('products-row-')).toEqual([106]);
});
