import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_DEFAULTS, CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import { CARD_CLASSES, classesOf } from './classes-of';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

// The fixture: Espresso and Cold Brew in Coffee (25), T-Shirt in Merch (27). Two out-of-stock extras:
// Decaf in Coffee, and Old Mug alone in Clearance (40).
const decaf = { ...products[0], id: 90, name: 'Decaf', sku: 'COF-DEC', stock_status: 'outofstock', stock_quantity: 0 };
const oldMug = { ...products[0], id: 91, name: 'Old Mug', sku: 'MUG-OLD', stock_status: 'outofstock', stock_quantity: 0, categories: [{ id: 40, name: 'Clearance' }] };
const catalogue = [...products, decaf, oldMug];

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products: catalogue,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

const termIds = () => screen.getAllByTestId(/^browse-(all-products|term-\d+)$/).map(node => node.getAttribute('data-testid'));
const productTiles = () => screen.queryAllByTestId(/^product-tile-\d+$/).map(node => node.getAttribute('data-testid'));
const productRows = () => screen.queryAllByTestId(/^product-row-\d+$/).map(node => node.getAttribute('data-testid'));
const footer = () => screen.getByTestId('data-table-count').textContent;
const search = (value: string) => fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value } });

test('the default view opens on All products and then a tile per category, by name, with no product tile', () => {
  render(<CatalogueView {...props} />);
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  expect(screen.getByTestId('browse-all-products').textContent).toBe('All products');
  expect(screen.getByTestId('browse-term-25').textContent).toBe('Coffee2 products');
  expect(screen.getByTestId('browse-term-27').textContent).toBe('Merch1 product');
  expect(productTiles()).toEqual([]);
});

test('the root footer reads the categories and the products the baseline lets through', () => {
  render(<CatalogueView {...props} />);
  expect(footer()).toBe('2 categories · 3 products');
  cleanup();
  render(<CatalogueView {...props} products={[products[0]]} />);
  expect(footer()).toBe('1 category · 1 product');
});

test('pressing a category opens its products under a crumb, and Categories returns to the tiles', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-27'));
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(screen.queryByTestId('browse-term-25')).toBeNull();
  const crumb = screen.getByTestId('products-breadcrumb');
  expect(within(crumb).getByTestId('products-breadcrumb-back').textContent).toBe('Categories');
  expect(crumb.textContent).toBe('CategoriesMerch');
  expect(footer()).toBe('1 product');
  fireEvent.click(screen.getByTestId('products-breadcrumb-back'));
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  expect(productTiles()).toEqual([]);
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
});

test('All products opens every product under the crumb Categories › All products', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-all-products'));
  expect(productTiles()).toEqual(['product-tile-84', 'product-tile-80', 'product-tile-102']);
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesAll products');
});

test('a search inside a level applies within the level, and Browse by stays in it', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  search('T-Shirt');
  expect(productTiles()).toEqual([]);
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesCoffee');
  search('Espresso');
  expect(productTiles()).toEqual(['product-tile-80']);
  expect(footer()).toBe('Showing 1 of 3');
});

test('the table view shows the term rows at the root, and a row opens the level as a table', () => {
  render(<CatalogueView {...props} viewState={{ ...CATALOGUE_VIEW_DEFAULTS, view: 'table' }} onViewStateChange={() => {}} />);
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  expect(screen.getByTestId('browse-term-25').textContent).toBe('Coffee2 products');
  expect(productRows()).toEqual([]);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  expect(productRows()).toEqual(['product-row-84', 'product-row-80']);
  expect(productTiles()).toEqual([]);
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesCoffee');
});

test("the table view's root rows sit in v2's table card, each row laid out as v2's", () => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
  render(<CatalogueView {...props} viewState={{ ...CATALOGUE_VIEW_DEFAULTS, view: 'table' }} onViewStateChange={() => {}} />);
  // v2's TableSurface (data-table/surface.tsx:31-36) round BrowseRootTable's rows (term-table.tsx:59).
  expect(classesOf('browse-root-card')).toEqual(expect.arrayContaining([...CARD_CLASSES, 'border-border', 'overflow-hidden', 'mx-3']));
  const inCard = within(screen.getByTestId('browse-root-card')).getAllByTestId(/^browse-(all-products|term-\d+)$/);
  expect(inCard.map(node => node.getAttribute('data-testid'))).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  // A 44 row with its hairline, whose cells carry the padding (term-row.tsx:60): none on the row itself.
  expect(classesOf('browse-term-25')).toEqual(expect.arrayContaining(['min-h-11', 'border-b', 'px-0', 'py-0']));
  expect(classesOf('browse-term-25')).not.toContain('py-2');
});

test("on a phone the table view's root card runs edge to edge under a hairline, as v2's", () => {
  render(<CatalogueView {...props} viewState={{ ...CATALOGUE_VIEW_DEFAULTS, view: 'table' }} onViewStateChange={() => {}} />);
  expect(classesOf('browse-root-card')).toEqual(expect.arrayContaining(['bg-card', 'border-border', 'border-t']));
  expect(classesOf('browse-root-card')).not.toContain('rounded-lg');
});

test('the grid view root has no table card', () => {
  render(<CatalogueView {...props} />);
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  expect(screen.queryByTestId('browse-root-card')).toBeNull();
});

test('a search at the root shows the matching products, and clearing it brings the tiles back', () => {
  render(<CatalogueView {...props} />);
  search('Cold');
  expect(screen.queryByTestId('browse-all-products')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-84']);
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
  search('');
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  expect(productTiles()).toEqual([]);
});

test('a Category chip set at the root shows the matching products, and clearing it brings the tiles back', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-pill-categories'));
  fireEvent.click(screen.getByTestId('category-option-27'));
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Merch');
  expect(screen.queryByTestId('browse-root')).toBeNull();
  expect(screen.queryByTestId('browse-all-products')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-102']);
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
  fireEvent.click(screen.getByTestId('filter-pill-remove-categories'));
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  expect(productTiles()).toEqual([]);
});

test('with out-of-stock hidden, a category of only out-of-stock products is absent and counts leave them out', () => {
  render(<CatalogueView {...props} />);
  expect(screen.queryByTestId('browse-term-40')).toBeNull();
  expect(screen.getByTestId('browse-term-25').textContent).toBe('Coffee2 products');
  cleanup();
  render(<CatalogueView {...props} viewState={{ ...CATALOGUE_VIEW_DEFAULTS, showOutOfStock: true }} onViewStateChange={() => {}} />);
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-40', 'browse-term-25', 'browse-term-27']);
  expect(screen.getByTestId('browse-term-25').textContent).toBe('Coffee3 products');
  expect(footer()).toBe('3 categories · 5 products');
});

test('browseBy all shows the flat product grid as before', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ ...CATALOGUE_VIEW_DEFAULTS, browseBy: 'all' }));
  render(<CatalogueView {...props} />);
  expect(screen.queryByTestId('browse-all-products')).toBeNull();
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-84', 'product-tile-80', 'product-tile-102']);
  expect(footer()).toBe('Showing 3 of 5');
});

test('Browse by in Product settings switches the root between the flat grid and the tiles; Tags stays disabled', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  const row = (value: string) => screen.getByTestId(`ui-settings-browse-by-${value}`);
  expect(row('categories').getAttribute('aria-checked')).toBe('true');
  fireEvent.click(row('all'));
  expect(row('all').getAttribute('aria-checked')).toBe('true');
  expect(row('categories').getAttribute('aria-checked')).toBe('false');
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).browseBy).toBe('all');
  expect(screen.queryByTestId('browse-all-products')).toBeNull();
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-84', 'product-tile-80', 'product-tile-102']);
  fireEvent.click(row('categories'));
  expect(row('categories').getAttribute('aria-checked')).toBe('true');
  // The level opened before the switch dropped with it: the root shows the tiles.
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
  expect(productTiles()).toEqual([]);
  expect(row('tags').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(row('tags'));
  expect(row('tags').getAttribute('aria-checked')).toBe('false');
  expect(row('categories').getAttribute('aria-checked')).toBe('true');
});

test('a quick filter applies inside a level, and pressing it again restores the baseline and drops the level', () => {
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([{ id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }] }]));
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(productTiles()).toEqual(['product-tile-84']);
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesCoffee');
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
  expect(termIds()).toEqual(['browse-all-products', 'browse-term-25', 'browse-term-27']);
});

test('a quick filter at the root shows the products it matches, not the tiles', () => {
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([{ id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }] }]));
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(screen.queryByTestId('browse-all-products')).toBeNull();
  expect(productTiles()).toEqual(['product-tile-84']);
});

test('pressing a product inside a level calls onSelect with that doc', () => {
  const onSelect = vi.fn();
  render(<CatalogueView {...props} onSelect={onSelect} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  fireEvent.click(screen.getByText('Espresso'));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith(products[0]);
});
