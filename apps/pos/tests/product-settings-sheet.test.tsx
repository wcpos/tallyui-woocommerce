import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { settingsSheetClassName } from '../components/catalogue-display-options';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
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

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

const decaf = { ...products[0], id: 90, name: 'Decaf', sku: 'COF-DEC', stock_status: 'outofstock', stock_quantity: 0 };
const tiles = () => screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt|Decaf)$/).map(n => n.textContent);
const stored = () => JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!);
const sale = { id: 'sale', type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }] };

function openSheet(extra: Partial<CatalogueViewProps> = {}): void {
  render(<><CatalogueView {...props} {...extra} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
}

test('the sheet shows v2\'s fields in v2\'s order', () => {
  openSheet();
  const text = screen.getByTestId('catalogue-settings').textContent!;
  const positions = ['View Mode', 'Tile Size', 'Browse by', 'Show out-of-stock products', 'Sort By', 'Sort Direction', 'Variations', 'Tile Fields', 'Restore Default Settings', 'Close']
    .map(label => text.indexOf(label));
  expect(positions[0]).toBeGreaterThanOrEqual(0);
  for (let i = 1; i < positions.length; i++) expect(positions[i]).toBeGreaterThan(positions[i - 1]);
});

test('the sheet sits on the side opposite the products', () => {
  const right = settingsSheetClassName('left');
  for (const token of ['right-0', 'border-l', 'h-full', 'max-w-lg', 'bg-card', 'rounded-none']) expect(right.split(' ')).toContain(token);
  const left = settingsSheetClassName('right').split(' ');
  expect(left).toContain('left-0');
  expect(left).toContain('border-r');
  expect(left).not.toContain('right-0');
});

test('View Mode in the sheet switches the catalogue to the table and back', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('view-mode-segment-table'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-84', 'product-row-80', 'product-row-102']);
  expect(screen.getByTestId('view-toggle-table').getAttribute('aria-checked')).toBe('true');
  expect(stored().view).toBe('table');
  expect(screen.getByTestId('column-toggle-name')).not.toBeNull();
  expect(screen.queryByTestId('tile-size')).toBeNull();
  fireEvent.click(screen.getByTestId('view-mode-segment-grid'));
  expect(screen.getByTestId('tile-size')).not.toBeNull();
});

test('Show out-of-stock products shows a sold-out product, saves the choice and survives a remount', () => {
  openSheet({ products: [...products, decaf] });
  expect(screen.queryByText('Decaf')).toBeNull();
  fireEvent.click(screen.getByRole('switch', { name: 'Show out-of-stock products' }));
  expect(tiles()).toContain('Decaf');
  expect(screen.queryByTestId('filter-pill-remove-stock_status')).toBeNull();
  expect(stored().showOutOfStock).toBe(true);
  cleanup();
  render(<><CatalogueView {...props} products={[...products, decaf]} /><PortalHost /></>);
  expect(screen.getByText('Decaf')).not.toBeNull();
});

test('turning Show out-of-stock products off hides them again and turns In Stock back on', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"showOutOfStock":true}');
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByRole('switch', { name: 'Show out-of-stock products' }));
  expect(screen.queryByText('Decaf')).toBeNull();
  expect(screen.getByTestId('filter-pill-remove-stock_status')).not.toBeNull();
});

test('restore hides out-of-stock products again', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"showOutOfStock":true}');
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByTestId('catalogue-settings-restore'));
  expect(screen.queryByText('Decaf')).toBeNull();
  expect(stored().showOutOfStock).toBe(false);
});

test('with out-of-stock products shown, pressing an applied quick filter again keeps them', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"showOutOfStock":true}');
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([sale]));
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByTestId('catalogue-settings-close'));
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(tiles()).toEqual(['Cold Brew']);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(tiles()).toContain('Decaf');
});

test('Sort By lists the fields the catalogue can sort in v2\'s order and copy', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('sort-by'));
  expect(screen.getAllByTestId(/^sort-by-option-/).map(node => node.textContent)).toEqual(['Name', 'SKU', 'Barcode', 'Price', 'Stock Quantity']);
});

test('Sort By and Sort Direction reorder the grid and save the sort', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('sort-direction-segment-desc'));
  expect(tiles()).toEqual(['T-Shirt', 'Espresso', 'Cold Brew']);
  fireEvent.click(screen.getByTestId('sort-by'));
  fireEvent.click(screen.getByTestId('sort-by-option-price'));
  expect(tiles()).toEqual(['T-Shirt', 'Cold Brew', 'Espresso']);
  expect(stored().sort).toEqual({ field: 'price', dir: 'desc' });
  fireEvent.click(screen.getByTestId('sort-direction-segment-asc'));
  expect(tiles()).toEqual(['Espresso', 'Cold Brew', 'T-Shirt']);
});

test('Browse by draws v2\'s sources with only All products available', () => {
  openSheet();
  const row = (value: string) => screen.getByTestId(`ui-settings-browse-by-${value}`);
  expect(row('all').getAttribute('aria-checked')).toBe('true');
  for (const value of ['categories', 'tags', 'brands', 'shortcuts']) expect(row(value).getAttribute('aria-disabled')).toBe('true');
  expect(row('categories').textContent).toContain('2 categories');
  expect(row('tags').textContent).toContain('No tags yet');
  expect(row('brands').textContent).toBe('Brands');
  expect(row('shortcuts').textContent).toContain('No shortcuts yet');
  const before = tiles();
  fireEvent.click(row('categories'));
  expect(row('all').getAttribute('aria-checked')).toBe('true');
  expect(tiles()).toEqual(before);
});

test('Browse by counts saved quick filters as shortcuts', () => {
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([sale]));
  openSheet();
  const shortcuts = screen.getByTestId('ui-settings-browse-by-shortcuts').textContent;
  expect(shortcuts).toContain('1 quick filter');
  expect(shortcuts).not.toContain('filters');
});

test('Variations offers Open in place and shows the inline style as unavailable', () => {
  openSheet();
  expect(screen.getByTestId('products-variations-style-segment-drill').getAttribute('aria-checked')).toBe('true');
  const inline = () => screen.getByTestId('products-variations-style-segment-inline');
  expect(inline().getAttribute('aria-disabled')).toBe('true');
  expect(inline().textContent).toBe('Popover');
  fireEvent.click(screen.getByTestId('view-mode-segment-table'));
  expect(inline().textContent).toBe('Expanded rows');
});

test('the close icon and Close both close the sheet', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('catalogue-settings-x'));
  expect(screen.queryByTestId('catalogue-settings')).toBeNull();
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('catalogue-settings-close'));
  expect(screen.queryByTestId('catalogue-settings')).toBeNull();
});

test('the out-of-stock switch comes before its label, as v2\'s FormSwitch', () => {
  openSheet();
  const row = screen.getByTestId('show-out-of-stock-row');
  const toggle = screen.getByTestId('show-out-of-stock');
  const label = screen.getByTestId('show-out-of-stock-label');
  expect(row.contains(toggle) && row.contains(label)).toBe(true);
  expect(toggle.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('pressing the label turns out-of-stock products on', () => {
  openSheet({ products: [...products, decaf] });
  fireEvent.click(screen.getByTestId('show-out-of-stock-label'));
  expect(screen.getByTestId('show-out-of-stock').getAttribute('aria-checked')).toBe('true');
  expect(stored().showOutOfStock).toBe(true);
});

test('a tile field label toggles its field, and the name column label does nothing', () => {
  openSheet();
  fireEvent.click(screen.getByTestId('tile-field-toggle-price-label'));
  expect(screen.getByTestId('tile-field-toggle-price').getAttribute('aria-checked')).toBe('false');
  expect(stored().tileFields.price).toBe(false);
  fireEvent.click(screen.getByTestId('view-mode-segment-table'));
  fireEvent.click(screen.getByTestId('column-toggle-name-label'));
  expect(screen.getByTestId('column-toggle-name').getAttribute('aria-checked')).toBe('true');
  expect(stored().columns.find((column: { id: string }) => column.id === 'name').visible).toBe(true);
});
