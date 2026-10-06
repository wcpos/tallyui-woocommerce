import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify(quickFilters));
});

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

const quickFilters: QuickFilter[] = [
  { id: 'sale', type: 'quick', label: 'On sale', conditions: [{ field: 'on_sale', value: true }] },
  { id: 'coffee', type: 'quick', label: 'Coffee by price', conditions: [{ field: 'categories', value: [25] }], sort: { field: 'price', dir: 'desc' } },
  { id: 'cheap', type: 'quick', label: 'Under 5', conditions: [{ field: 'price', value: { max: 5 } }, { field: 'search', value: 'Esp' }] },
];

test('no saved quick filters shows no filter bar', () => {
  localStorage.removeItem(QUICK_FILTERS_KEY);
  render(<CatalogueView {...props} />);
  expect(screen.queryByTestId('quick-filter-bar')).toBeNull();
  for (const product of products) expect(screen.getByText(product.name)).not.toBeNull();
});

test('saved quick filters show as buttons in order', () => {
  render(<CatalogueView {...props} />);
  const buttons = within(screen.getByTestId('quick-filter-bar')).getAllByRole('button');
  expect(buttons.map(button => button.textContent)).toEqual(['On sale', 'Coffee by price', 'Under 5']);
  expect(buttons.map(button => button.getAttribute('data-testid'))).toEqual(['quick-filter-sale', 'quick-filter-coffee', 'quick-filter-cheap']);
  for (const button of buttons) expect(button.getAttribute('aria-pressed')).toBe('false');
});

test('pressing a quick filter shows only its products and marks it active', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(screen.getByText('Cold Brew')).not.toBeNull();
  expect(screen.queryByText('Espresso')).toBeNull();
  expect(screen.queryByText('T-Shirt')).toBeNull();
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('quick-filter-coffee').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('quick-filter-cheap').getAttribute('aria-pressed')).toBe('false');
});

test('pressing the active quick filter restores the baseline', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  for (const product of products) expect(screen.getByText(product.name)).not.toBeNull();
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('false');
});

test('pressing another quick filter replaces the first', () => {
  const { container } = render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('quick-filter-coffee'));
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByText('Cold Brew')).not.toBeNull();
  expect(screen.queryByText('T-Shirt')).toBeNull();
  expect(container.textContent!.indexOf('Cold Brew')).toBeLessThan(container.textContent!.indexOf('Espresso'));
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('quick-filter-coffee').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('quick-filter-cheap').getAttribute('aria-pressed')).toBe('false');
});

test('a quick filter with a search fills the search box', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-cheap'));
  expect((screen.getByPlaceholderText('Search name, SKU or barcode') as HTMLInputElement).value).toBe('Esp');
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.queryByText('Cold Brew')).toBeNull();
  expect(screen.queryByText('T-Shirt')).toBeNull();
});

test('typing in search turns the active quick filter off but keeps its filters', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  const search = screen.getByPlaceholderText('Search name, SKU or barcode');
  fireEvent.change(search, { target: { value: 'Cold' } });
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByText('Cold Brew')).not.toBeNull();
  fireEvent.change(search, { target: { value: 'Esp' } });
  expect(screen.getByText('No products match')).not.toBeNull();
});

test('the quick filter sort does not change the saved sort', () => {
  const saved = localStorage.getItem(CATALOGUE_VIEW_KEY);
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-coffee'));
  expect(localStorage.getItem(CATALOGUE_VIEW_KEY)).toBe(saved);
});

test('a filter that matches nothing shows No products match', () => {
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([
    { id: 'ext', type: 'quick', label: 'External', conditions: [{ field: 'type', value: 'external' }] },
  ]));
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('quick-filter-ext'));
  expect(screen.getByText('No products match')).not.toBeNull();
});
