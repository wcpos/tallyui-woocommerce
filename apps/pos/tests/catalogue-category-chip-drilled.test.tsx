import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import { ProductsScreen } from '../components/products-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';

// v2's filter-bar.tsx:505: while a browse level is open, the place's own pill folds (`item.id === place?.field`),
// the crumb being the place. Under Browse by Categories that is the Category chip, in a category, in All products
// and under a product drilled inside the level; In Stock, On Sale and Tag stay. A product drilled from no level
// only dims the chips (filter-bar.tsx:508), so Category stays there.

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// T-Shirt (102, Merch 27) with three full variants; Espresso (80, Coffee 25).
const attributes = [
  { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
  { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
];
const docs = variations.documents.map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }));
const shirt = { ...products[2], attributes, variation_docs: docs };

function renderView() {
  render(<><CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={[products[0], shirt]}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} onSelect={vi.fn()} onAddEntry={vi.fn()} /><PortalHost /></>);
}
const chip = (field: string) => screen.queryByTestId(`filter-pill-${field}`);
const disabled = (field: string) => chip(field)?.getAttribute('aria-disabled') === 'true';

test('with a variable product drilled in inside a category, there is no Category chip; In Stock, On Sale and Tag stay, dimmed as v2 has them', () => {
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  fireEvent.click(screen.getByTestId('product-tile-102'));
  expect(screen.getByTestId('drill-back')).not.toBeNull();
  expect(chip('categories')).toBeNull();
  expect(chip('stock_status')).not.toBeNull();
  expect(chip('on_sale')).not.toBeNull();
  expect(chip('tags')).not.toBeNull();
  expect(disabled('stock_status')).toBe(false);
  expect(disabled('on_sale')).toBe(true);
  expect(disabled('tags')).toBe(true);
});

test('with a category opened, there is no Category chip, and the others stay live', () => {
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-25'));
  expect(screen.getByTestId('browse-parent-tile')).not.toBeNull();
  expect(chip('categories')).toBeNull();
  for (const field of ['stock_status', 'on_sale', 'tags']) {
    expect(chip(field)).not.toBeNull();
    expect(disabled(field)).toBe(false);
  }
});

test('with All products opened, the Categories source\'s place, there is no Category chip either', () => {
  renderView();
  fireEvent.click(screen.getByTestId('browse-all-products'));
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesAll products');
  expect(chip('categories')).toBeNull();
  expect(chip('tags')).not.toBeNull();
});

test('with nothing drilled, the Category chip is there, and it comes back on the way out of a level', () => {
  renderView();
  expect(chip('categories')).not.toBeNull();
  expect(disabled('categories')).toBe(false);
  fireEvent.click(screen.getByTestId('browse-term-27'));
  expect(chip('categories')).toBeNull();
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  expect(chip('categories')).not.toBeNull();
});

test('a variable product drilled in from no level keeps the Category chip, dimmed (v2 dims, it does not fold)', () => {
  data.set(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  renderView();
  fireEvent.click(screen.getByTestId('product-tile-102'));
  expect(screen.getByTestId('drill-back')).not.toBeNull();
  expect(chip('categories')).not.toBeNull();
  expect(disabled('categories')).toBe(true);
});

test('the Products area still shows its Category chip', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
  render(<ProductsScreen products={[products[0], shirt]} connector={createWooCommerceConnector()} currency="USD" locale="en_US" onBack={vi.fn()} />,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
  expect(chip('categories')).not.toBeNull();
  expect(chip('categories')?.textContent).toBe('Category');
});
