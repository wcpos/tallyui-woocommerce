import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { CatalogueView } from '../components/catalogue-view';
import { CATALOGUE_VIEW_DEFAULTS, CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { classesOf } from './classes-of';
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

const renderView = () => render(<CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={products}
  storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} />);
const withFacts = (facts: { sku: boolean; barcode: boolean; category: boolean }) =>
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all', tileFields: { ...CATALOGUE_VIEW_DEFAULTS.tileFields, ...facts } }));

test('the tile facts sit in one facts row, SKU then barcode then category', () => {
  renderView();
  const row = screen.getByTestId('tile-facts-80');
  const [sku, barcode, category] = ['tile-sku-80', 'tile-barcode-80', 'tile-category-80'].map(id => screen.getByTestId(id));
  for (const fact of [sku, barcode, category]) expect(row.contains(fact)).toBe(true);
  expect(sku.compareDocumentPosition(barcode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(barcode.compareDocumentPosition(category) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test('the SKU label is its own soft element', () => {
  renderView();
  const label = screen.getByTestId('tile-sku-label-80');
  expect(screen.getByTestId('tile-sku-80').contains(label)).toBe(true);
  expect(label.textContent).toBe('SKU ');
  expect(classesOf('tile-sku-label-80')).toContain('text-foreground/65');
  // The value is in the foreground ink, as v2's; the row wraps as v2's factsRow.
  expect(classesOf('tile-sku-80')).not.toContain('text-muted-foreground');
  expect(classesOf('tile-facts-80')).toEqual(expect.arrayContaining(['flex-row', 'flex-wrap', 'gap-x-2.5', 'gap-y-px', 'overflow-hidden']));
});

test('no facts row when every fact is off', () => {
  withFacts({ sku: false, barcode: false, category: false });
  renderView();
  expect(screen.getByTestId('product-tile-80')).not.toBeNull();
  expect(screen.queryByTestId('tile-facts-80')).toBeNull();
});

test('with only Barcode on, the row holds just the barcode', () => {
  withFacts({ sku: false, barcode: true, category: false });
  renderView();
  const row = screen.getByTestId('tile-facts-80');
  expect(row.contains(screen.getByTestId('tile-barcode-80'))).toBe(true);
  expect(screen.queryByTestId('tile-sku-80')).toBeNull();
  expect(screen.queryByTestId('tile-category-80')).toBeNull();
  expect(row.textContent).toBe('2000000000015');
});
