import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_DEFAULTS } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

// v2's TermLevelGrid (term-grid.tsx): an opened term's own tile is slot 0 of its grid, the way back.

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
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

// The fixture: Espresso (80) and Cold Brew (84) in Coffee (25), T-Shirt (102) in Merch (27).
const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

const ROOT = ['browse-all-products', 'browse-term-25', 'browse-term-27'];
const termIds = () => screen.queryAllByTestId(/^browse-(all-products|term-\d+)$/).map(node => node.getAttribute('data-testid'));
// The level's slots in order: the parent tile, then the product tiles.
const slots = () => within(screen.getByTestId('browse-level')).queryAllByTestId(/^(browse-parent-tile|product-tile-\d+)$/)
  .map(node => node.getAttribute('data-testid'));
const footer = () => screen.getByTestId('data-table-count').textContent;

test('opening a term shows its own tile first, with its name, then its products', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  expect(slots()).toEqual(['browse-parent-tile', 'product-tile-84', 'product-tile-80']);
  const parent = screen.getByTestId('browse-parent-tile');
  expect(screen.getByTestId('browse-parent-tile-name').textContent).toBe('Coffee');
  expect(parent.textContent).toBe('Coffee2 products');
  expect(parent.getAttribute('aria-label')).toBe('Back');
  expect(within(parent).getByTestId('browse-parent-back')).not.toBeNull();
  expect(termIds()).toEqual([]);
});

test('All products opens with its own tile first, then every product', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-all-products'));
  expect(slots()).toEqual(['browse-parent-tile', 'product-tile-84', 'product-tile-80', 'product-tile-102']);
  expect(screen.getByTestId('browse-parent-tile').textContent).toBe('All products');
});

test('pressing the back chevron returns to the root term set', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-27'));
  fireEvent.click(screen.getByTestId('browse-parent-back'));
  expect(termIds()).toEqual(ROOT);
  expect(screen.queryByTestId('browse-parent-tile')).toBeNull();
  expect(screen.queryByTestId('products-breadcrumb')).toBeNull();
});

test('pressing the parent tile itself returns to the root term set', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-all-products'));
  fireEvent.click(screen.getByTestId('browse-parent-tile'));
  expect(termIds()).toEqual(ROOT);
  expect(screen.queryByTestId('browse-parent-tile')).toBeNull();
});

test('an empty level still shows the parent tile, with the empty state under it', () => {
  const { rerender } = render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-27'));
  // T-Shirt leaves the catalogue while Merch is open: the level has no products.
  rerender(<CatalogueView {...props} products={products.filter(doc => doc.id !== 102)} />);
  expect(slots()).toEqual(['browse-parent-tile']);
  expect(screen.getByTestId('browse-parent-tile').textContent).toBe('Merch');
  expect(screen.getByTestId('browse-level-empty').textContent).toBe('No products match');
  expect(footer()).toBe('0 products');
});

test('a search with no match inside a level keeps the parent tile and shows the empty state', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value: 'T-Shirt' } });
  expect(slots()).toEqual(['browse-parent-tile']);
  expect(screen.getByTestId('browse-level-empty').textContent).toBe('No products match');
});

test('a level with products shows no empty state', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  expect(screen.queryByTestId('browse-level-empty')).toBeNull();
});

test('the footer counts the level\'s products, not the parent tile', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  expect(footer()).toBe('2 products');
  fireEvent.click(screen.getByTestId('browse-parent-back'));
  fireEvent.click(screen.getByTestId('browse-term-27'));
  expect(footer()).toBe('1 product');
});

test('the table view of a level has no parent tile', () => {
  render(<CatalogueView {...props} viewState={{ ...CATALOGUE_VIEW_DEFAULTS, view: 'table' }} onViewStateChange={() => {}} />);
  fireEvent.click(screen.getByTestId('browse-term-25'));
  expect(screen.queryByTestId('browse-parent-tile')).toBeNull();
  expect(screen.getByTestId('products-breadcrumb').textContent).toBe('CategoriesCoffee');
});
