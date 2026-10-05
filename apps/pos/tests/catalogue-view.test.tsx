import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

afterEach(cleanup);

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
