import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { classesOf } from './classes-of';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

// Browse by now opens on category tiles; these tests drive the flat product grid, so they browse All products.
beforeEach(() => { localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' })); });

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

const catalogue = [
  products[0],                                                    // Espresso, 80, Coffee, in stock
  { ...products[1], tags: [{ id: 8, name: 'Cold' }] },            // Cold Brew, 84, Coffee, on sale
  products[2],                                                    // T-Shirt, 102, Merch
  { ...products[0], id: 90, name: 'Banana Bread', stock_status: 'outofstock', stock_quantity: 0,
    categories: [{ id: 30, name: 'Bakery' }], tags: [{ id: 7, name: 'Vegan' }] },
  { ...products[1], id: 91, name: 'Iced Latte', stock_status: 'onbackorder', stock_quantity: 0,
    tags: [{ id: 8, name: 'Cold' }] },
];

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products: catalogue,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

function visible(name: string): boolean { return screen.queryByText(name) !== null; }

function quick(filters: unknown[]): void { localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify(filters)); }

function renderView(overrides: Partial<CatalogueViewProps> = {}) {
  return render(<><CatalogueView {...props} {...overrides} /><PortalHost /></>);
}

const coffee = { id: 'coffee', type: 'quick', label: 'Coffee', conditions: [{ field: 'categories', value: [25] }] };

test('the filter chips show under the search with In Stock on', () => {
  renderView();
  expect(screen.getByTestId('filter-chips').textContent).toBe('In StockOn SaleCategoryTag');
  expect(screen.getByTestId('filter-pill-remove-stock_status')).not.toBeNull();
  for (const name of ['Espresso', 'Cold Brew', 'T-Shirt']) expect(visible(name)).toBe(true);
  for (const name of ['Banana Bread', 'Iced Latte']) expect(visible(name)).toBe(false);
});

test('an on chip is v2\'s borderless selected tint with one selected ink on icon and clear; an off chip stays on the card', () => {
  renderView();
  const glyph = (testID: string) => screen.getByTestId(testID).querySelector('svg')?.getAttribute('class') ?? '';
  expect(glyph('filter-pill-stock_status')).toBe('text-selected-foreground');
  expect(glyph('filter-pill-remove-stock_status')).toBe('text-selected-foreground');
  expect(classesOf('filter-pill-on_sale')).toEqual(expect.arrayContaining(['border-border', 'bg-card']));
  expect(glyph('filter-pill-on_sale')).toBe('');
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  expect(classesOf('filter-pill-on_sale')).toEqual(expect.arrayContaining(['border-selected', 'bg-selected']));
  expect(classesOf('filter-pill-on_sale')).not.toContain('border-primary');
  expect(glyph('filter-pill-on_sale')).toBe('text-selected-foreground');
});

test("the clear is v2's trailing cell, the chip's height square over its end padding, with v2's 16 mark", () => {
  renderView();
  expect(classesOf('filter-pill-remove-stock_status'))
    .toEqual(expect.arrayContaining(['min-w-11', '-mr-3', 'items-center', 'justify-center', 'self-stretch']));
  const mark = screen.getByTestId('filter-pill-remove-stock_status').querySelector('svg')!;
  expect([mark.getAttribute('width'), mark.getAttribute('height')]).toEqual(['16', '16']);
});

test('removing In Stock shows sold-out and backorder products', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  expect(visible('Banana Bread')).toBe(true);
  expect(visible('Iced Latte')).toBe(true);
  expect(screen.getByTestId('tile-sold-out-90').textContent).toBe('Sold out');
  expect(screen.queryByTestId('filter-pill-remove-stock_status')).toBeNull();
  expect(screen.getByTestId('filter-pill-stock_status').textContent).toBe('Stock Status');
});

test('choosing Out of Stock shows only sold-out products', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-stock_status'));
  fireEvent.click(screen.getByTestId('stock-status-option-outofstock'));
  expect(visible('Banana Bread')).toBe(true);
  expect(visible('Espresso')).toBe(false);
  expect(visible('Iced Latte')).toBe(false);
  expect(screen.getByTestId('filter-pill-stock_status').textContent).toBe('Out of Stock');
});

test('On Sale toggles on and off', () => {
  renderView();
  const pill = () => screen.getByTestId('filter-pill-on_sale');
  expect(pill().getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(pill());
  expect(pill().getAttribute('aria-pressed')).toBe('true');
  expect(visible('Cold Brew')).toBe(true);
  expect(visible('Espresso')).toBe(false);
  fireEvent.click(pill());
  expect(pill().getAttribute('aria-pressed')).toBe('false');
  expect(visible('Espresso')).toBe(true);
  expect(visible('Cold Brew')).toBe(true);
});

test('Category lists the synced categories and narrows the grid', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-categories'));
  expect(screen.getAllByTestId(/^category-option-/).map(el => el.getAttribute('data-testid')))
    .toEqual(['category-option-30', 'category-option-25', 'category-option-27']);
  fireEvent.click(screen.getByTestId('category-option-27'));
  expect(visible('T-Shirt')).toBe(true);
  expect(visible('Espresso')).toBe(false);
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Merch');
  fireEvent.click(screen.getByTestId('filter-pill-remove-categories'));
  expect(visible('Espresso')).toBe(true);
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Category');
  fireEvent.click(screen.getByTestId('filter-pill-categories'));
  fireEvent.click(screen.getByTestId('category-option-30'));
  expect(screen.getByText('No products match')).not.toBeNull();
});

test('Tag narrows the grid to products with that tag', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-tags'));
  fireEvent.click(screen.getByTestId('tag-option-8'));
  expect(visible('Cold Brew')).toBe(true);
  expect(visible('Espresso')).toBe(false);
  expect(visible('Iced Latte')).toBe(false);
  expect(screen.getByTestId('filter-pill-tags').textContent).toBe('Cold');
  fireEvent.click(screen.getByTestId('filter-pill-remove-tags'));
  expect(visible('Espresso')).toBe(true);
});

test('a category quick filter keeps In Stock on and shows its chip', () => {
  quick([coffee]);
  renderView();
  fireEvent.click(screen.getByTestId('quick-filter-coffee'));
  expect(visible('Espresso')).toBe(true);
  expect(visible('Cold Brew')).toBe(true);
  expect(visible('Iced Latte')).toBe(false);
  expect(visible('T-Shirt')).toBe(false);
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Coffee');
  expect(screen.getByTestId('filter-pill-remove-stock_status')).not.toBeNull();
  expect(screen.getByTestId('quick-filter-coffee').getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-coffee'));
  expect(screen.getByTestId('quick-filter-coffee').getAttribute('aria-pressed')).toBe('false');
  expect(visible('T-Shirt')).toBe(true);
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Category');
  expect(screen.getByTestId('filter-pill-remove-stock_status')).not.toBeNull();
});

test('a quick filter with two categories shows the first name and a count', () => {
  quick([{ id: 'both', type: 'quick', label: 'Both', conditions: [{ field: 'categories', value: [25, 27] }] }]);
  renderView();
  fireEvent.click(screen.getByTestId('quick-filter-both'));
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Coffee+1');
});

test('removing In Stock turns an applied quick filter off', () => {
  quick([coffee]);
  renderView();
  fireEvent.click(screen.getByTestId('quick-filter-coffee'));
  fireEvent.click(screen.getByTestId('filter-pill-remove-stock_status'));
  expect(screen.getByTestId('quick-filter-coffee').getAttribute('aria-pressed')).toBe('false');
  expect(visible('Iced Latte')).toBe(true);
});

test('sold-out products hidden by In Stock say No products match', () => {
  renderView({ products: [catalogue[3]] });
  expect(screen.getByText('No products match')).not.toBeNull();
});
