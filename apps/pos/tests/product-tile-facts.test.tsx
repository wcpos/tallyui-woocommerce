import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import { CATALOGUE_VIEW_DEFAULTS, CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); } });
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all', tileFields: { ...CATALOGUE_VIEW_DEFAULTS.tileFields, sku: true, barcode: true, category: true } }));
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('a tile labels its SKU as v2\'s "SKU COF-ESP"', () => {
  render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} />);
  expect(screen.getByTestId('tile-sku-80').textContent).toBe('SKU COF-ESP');
  expect(screen.getByTestId('tile-barcode-80').textContent).toBe('2000000000015');
});

test('the tile facts follow v2\'s order: SKU, barcode, category', () => {
  render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} />);
  const [sku, barcode, category] = ['tile-sku-80', 'tile-barcode-80', 'tile-category-80'].map(id => screen.getByTestId(id));
  expect(sku.compareDocumentPosition(barcode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(barcode.compareDocumentPosition(category) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
