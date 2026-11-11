import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { SaleScreen } from '../components/sale-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { noTaxSettings } from './fixtures/store-settings';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';
import { cartTabCount } from './phone-tabs-helpers';

let data: Map<string, string>;
const view = (state: object) => data.set(CATALOGUE_VIEW_KEY, JSON.stringify(state));
beforeEach(() => {
  data = new Map();
  view({ browseBy: 'all' });
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// T-Shirt (102, Merch) with three full variants: S / Black (104), S / White (105), M / Black (106).
const attributes = [
  { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
  { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
];
const docs = variations.documents.map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }));
const shirt = { ...products[2], attributes, variation_docs: docs };
const outM = { ...shirt, variation_docs: docs.map(doc => doc.id === 106 ? { ...doc, stock_status: 'outofstock', stock_quantity: 0 } : doc) };

function renderView(items: unknown[] = [products[0], shirt], extra: Partial<CatalogueViewProps> = {}) {
  const onSelect = vi.fn(), onAddEntry = vi.fn();
  render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={items}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} onSelect={onSelect} onAddEntry={onAddEntry} {...extra} />);
  return { onSelect, onAddEntry };
}
const variationTiles = () => screen.queryAllByTestId(/^variation-tile-\d+$/).map(node => node.getAttribute('data-testid'));
const productTiles = () => screen.queryAllByTestId(/^product-tile-\d+$/).map(node => node.getAttribute('data-testid'));
const drillIn = () => fireEvent.click(screen.getByTestId('product-tile-102'));

test('a grid tap on a product with full variants drills in: back badge, crumb, parent tile, one tile per variant', () => {
  const { onSelect } = renderView();
  drillIn();
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  expect(screen.getByTestId('drill-back').getAttribute('aria-label')).toBe('Back');
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('ProductsT-Shirt');
  expect(screen.getByTestId('products-breadcrumb-here').textContent).toBe('T-Shirt');
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(variationTiles()).toEqual(['variation-tile-104', 'variation-tile-105', 'variation-tile-106']);
  const tile = within(screen.getByTestId('variation-tile-106'));
  expect(tile.getByText('T-Shirt')).not.toBeNull();
  expect(screen.getByTestId('variation-chip-106-Size').textContent).toBe('M');
  expect(screen.getByTestId('variation-chip-106-Colour').textContent).toBe('Black');
  expect(screen.getByTestId('variation-price-106').textContent).toBe('$25.00');
  expect(screen.getByTestId('data-table-count').textContent).toBe('3 options');
});

test('tapping a variation tile adds that entry, and the drill-in stays', () => {
  const { onAddEntry, onSelect } = renderView();
  drillIn();
  fireEvent.click(screen.getByTestId('variation-tile-105'));
  expect(onAddEntry).toHaveBeenCalledTimes(1);
  expect(onAddEntry.mock.calls[0][0].variant.id).toBe('105');
  expect(onAddEntry.mock.calls[0][0].product.id).toBe(102);
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByTestId('drill-back')).not.toBeNull();
});

test('the back badge returns to the product tiles', () => {
  renderView();
  drillIn();
  fireEvent.click(screen.getByTestId('drill-back'));
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(variationTiles()).toEqual([]);
  expect(productTiles()).toEqual(['product-tile-80', 'product-tile-102']);
});

test('in a category the crumb ends in the product; the category crumb returns to its products, Categories to the root', () => {
  view({ browseBy: 'categories' });
  renderView();
  fireEvent.click(screen.getByTestId('browse-term-27'));
  drillIn();
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerchT-Shirt');
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesMerch');
  drillIn();
  fireEvent.click(screen.getByTestId('products-breadcrumb-root'));
  expect(screen.getByTestId('browse-root')).not.toBeNull();
});

test('with In Stock on an out-of-stock variant is left out; with it off the variant reads Sold out', () => {
  renderView([outM]);
  drillIn();
  expect(variationTiles()).toEqual(['variation-tile-104', 'variation-tile-105']);
  expect(screen.getByTestId('data-table-count').textContent).toBe('2 options');
  fireEvent.click(screen.getByTestId('drill-back'));
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  drillIn();
  expect(variationTiles()).toEqual(['variation-tile-104', 'variation-tile-105', 'variation-tile-106']);
  expect(screen.getByTestId('variation-sold-out-106').textContent).toBe('Sold out');
  expect(screen.getByTestId('tile-picture-variation-106').style.opacity).toBe('0.4');
});

test('typing in the search leaves the drill-in', () => {
  renderView();
  drillIn();
  expect(screen.getByTestId('drill-back')).not.toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value: 'shirt' } });
  expect(screen.queryByTestId('drill-back')).toBeNull();
  expect(variationTiles()).toEqual([]);
  expect(productTiles()).toEqual(['product-tile-102']);
});

test('a variant that leaves a group open ("Any") keeps the chooser path', () => {
  const anySize = { ...shirt, variation_docs: [docs[0], { ...docs[1], attributes: [{ id: 0, name: 'Colour', slug: 'colour', option: 'White' }] }] };
  const { onSelect } = renderView([anySize]);
  drillIn();
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('drill-back')).toBeNull();
});

test('in the table a variable product keeps the chooser path', () => {
  view({ browseBy: 'all', view: 'table' });
  const { onSelect } = renderView();
  fireEvent.click(screen.getByText('T-Shirt'));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('drill-back')).toBeNull();
});

test('on the till a variation tile adds its variant to the cart, with no picker', () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 600, height: 800, scale: 1, fontScale: 1 });
  render(<><SaleScreen storeSettings={noTaxSettings} connector={createWooCommerceConnector()} currency={stores[0].currency}
    products={[shirt]} storeName={stores[0].name} cashierName="Paul" cashierRef="2" status="ready" onSignOut={() => {}} /><PortalHost /></>);
  drillIn();
  expect(screen.queryByTestId('variation-picker')).toBeNull();
  fireEvent.click(screen.getByTestId('variation-tile-106'));
  expect(cartTabCount()).toBe('1');
  expect(screen.getByTestId('drill-back')).not.toBeNull();
});
