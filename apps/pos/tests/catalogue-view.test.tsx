import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => { vi.stubGlobal('localStorage', memoryStorage()); });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
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

test('renders fixture names, store, cashier and prices in the store currency', () => {
  render(<CatalogueView {...props} />);
  for (const product of products) expect(screen.getByText(product.name)).not.toBeNull();
  expect(screen.getByText(stores[0].name)).not.toBeNull();
  expect(screen.getByText('Cashier: Paul')).not.toBeNull();
  expect(screen.getByText('$3.00')).not.toBeNull();
  expect(screen.getByText('3 products')).not.toBeNull();
});

test.each([products[0].sku, products[0].global_unique_id, 'Espres'])('searches by %s', term => {
  render(<CatalogueView {...props} />);
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: term } });
  expect(screen.getByText(products[0].name)).not.toBeNull();
  for (const product of products.slice(1)) expect(screen.queryByText(product.name)).toBeNull();
});

test('calls onSignOut', () => {
  const onSignOut = vi.fn();
  render(<CatalogueView {...props} onSignOut={onSignOut} />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledOnce();
});

test('shows the syncing status', () => {
  render(<CatalogueView {...props} status="syncing" />);
  expect(screen.getByText('Syncing products…')).not.toBeNull();
});

test('shows notices and the error status on the single status line', () => {
  const { rerender } = render(<CatalogueView {...props} notice={{ code: 'auth', message: 'Sign in again' }} />);
  expect(screen.getByText('Sign in again')).not.toBeNull();
  expect(screen.queryByText('3 products')).toBeNull();
  rerender(<CatalogueView {...props} notice={{ code: 'auth' }} />);
  expect(screen.getByText('auth')).not.toBeNull();
  rerender(<CatalogueView {...props} status="error" />);
  expect(screen.getByText('Sync failed')).not.toBeNull();
});

test('distinguishes an empty catalogue from an unmatched search', () => {
  render(<CatalogueView {...props} products={[]} />);
  expect(screen.getByText('No products yet')).not.toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: 'missing' } });
  expect(screen.getByText('No products match')).not.toBeNull();
});

test('shows the grid by default with names in ascending order', () => {
  render(<CatalogueView {...props} />);
  expect(screen.getByTestId('view-toggle-grid').getAttribute('aria-checked')).toBe('true');
  expect(screen.queryAllByTestId(/^product-row-/)).toHaveLength(0);
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['Cold Brew', 'Espresso', 'T-Shirt']);
});

test('toggles to a name-sorted table and saves the view', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-84', 'product-row-80', 'product-row-102']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).view).toBe('table');
});

test('the table view survives a remount', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  cleanup();
  render(<CatalogueView {...props} />);
  expect(screen.getByTestId('product-row-80')).not.toBeNull();
  expect(screen.getByTestId('view-toggle-table').getAttribute('aria-checked')).toBe('true');
});

test.each(['{not json', '{"view":"list","gridColumns":99}'])('bad stored value %s falls back to the name-sorted grid', raw => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, raw);
  render(<CatalogueView {...props} />);
  expect(screen.getByTestId('view-toggle-grid').getAttribute('aria-checked')).toBe('true');
  expect(screen.queryAllByTestId(/^product-row-/)).toHaveLength(0);
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['Cold Brew', 'Espresso', 'T-Shirt']);
});

test('price header cycles through ascending, descending and unsorted and saves each sort', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  fireEvent.click(screen.getByTestId('product-table-sort-price'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80', 'product-row-84', 'product-row-102']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).sort).toEqual({ field: 'price', dir: 'asc' });
  fireEvent.click(screen.getByTestId('product-table-sort-price'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-102', 'product-row-84', 'product-row-80']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).sort).toEqual({ field: 'price', dir: 'desc' });
  fireEvent.click(screen.getByTestId('product-table-sort-price'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80', 'product-row-84', 'product-row-102']);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).sort).toBeNull();
});

test('the grid follows the stored sort', () => {
  localStorage.setItem(CATALOGUE_VIEW_KEY, '{"view":"grid","gridColumns":4,"sort":{"field":"price","dir":"desc"},"categoryId":null}');
  render(<CatalogueView {...props} />);
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['T-Shirt', 'Cold Brew', 'Espresso']);
});

test('pressing a table row selects its product once', () => {
  const onSelect = vi.fn();
  render(<CatalogueView {...props} onSelect={onSelect} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  fireEvent.click(screen.getByTestId('product-row-80'));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onSelect).toHaveBeenCalledWith(products[0]);
});

test('search filters the table', () => {
  render(<CatalogueView {...props} />);
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: 'Espres' } });
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80']);
});

test('search text survives toggling views', () => {
  render(<CatalogueView {...props} />);
  fireEvent.change(screen.getByPlaceholderText('Search name, SKU or barcode'), { target: { value: 'Espres' } });
  fireEvent.click(screen.getByTestId('view-toggle-table'));
  expect(screen.getAllByTestId(/^product-row-/).map(node => node.getAttribute('data-testid'))).toEqual(['product-row-80']);
  fireEvent.click(screen.getByTestId('view-toggle-grid'));
  expect(screen.getAllByText(/^(Espresso|Cold Brew|T-Shirt)$/).map(node => node.textContent)).toEqual(['Espresso']);
});
