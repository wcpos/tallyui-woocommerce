import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_COLUMNS, CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';

let data: Map<string, string>;
const view = (state: object) => data.set(CATALOGUE_VIEW_KEY, JSON.stringify(state));
beforeEach(() => {
  data = new Map();
  view({ browseBy: 'all', variationsStyle: 'inline', view: 'table' });
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
// As catalogue-drill-in.test: 105 leaves Size open ("Any").
const anySize = { ...shirt, variation_docs: [docs[0], { ...docs[1], attributes: [{ id: 0, name: 'Colour', slug: 'colour', option: 'White' }] }] };

function renderView(items: unknown[] = [products[0], shirt], extra: Partial<CatalogueViewProps> = {}) {
  const onSelect = vi.fn(), onAddEntry = vi.fn();
  render(<><CatalogueView connector={createWooCommerceConnector()} currency={stores[0].currency} products={items}
    storeName={stores[0].name} cashierName="Paul" status="ready" onSignOut={() => {}} onSelect={onSelect} onAddEntry={onAddEntry} {...extra} />
  <PortalHost /></>);
  return { onSelect, onAddEntry };
}
const variationRows = () => screen.queryAllByTestId(/^product-row-variation-/);
const toggle = () => within(screen.getByTestId('product-row-102')).getByTestId('variable-product-expand');
const search = (value: string) => fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value } });

test('the variable row shows its attribute rows and a collapsed "3 variations" toggle instead of options', () => {
  renderView();
  expect(screen.getByTestId('product-attributes-102-Size')).not.toBeNull();
  expect(screen.getByTestId('product-attributes-102-Colour')).not.toBeNull();
  expect(screen.queryByTestId('product-options-102')).toBeNull();
  expect(screen.queryByTestId('variable-product-drill-102')).toBeNull();
  expect(toggle().textContent).toBe('3 variations');
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
});

test('a row tap expands the variation rows directly under the product, and a second tap collapses them', () => {
  const { onSelect, onAddEntry } = renderView();
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(screen.getAllByTestId(/^product-row-/).map(row => row.getAttribute('data-testid')).slice(-4)).toEqual([
    'product-row-102', 'product-row-variation-104', 'product-row-variation-105', 'product-row-variation-106',
  ]);
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
  expect(onSelect).not.toHaveBeenCalled();
  expect(onAddEntry).not.toHaveBeenCalled();
  expect(screen.queryByTestId('catalogue-variations-table')).toBeNull();
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(variationRows()).toEqual([]);
});

test('the toggle opens and closes the rows once per press', () => {
  renderView();
  fireEvent.click(toggle());
  expect(variationRows()).toHaveLength(3);
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(toggle());
  expect(variationRows()).toEqual([]);
  expect(toggle().getAttribute('aria-expanded')).toBe('false');
});

test('an option link opens the rows without filtering them', () => {
  renderView();
  fireEvent.click(screen.getByTestId('product-attribute-102-Size-M'));
  expect(variationRows()).toHaveLength(3);
  fireEvent.click(screen.getByTestId('product-attribute-102-Size-M'));
  expect(variationRows()).toHaveLength(3);
});

test('a variation row shows its option chips and price, and a tap adds that variation once', () => {
  const { onSelect, onAddEntry } = renderView();
  fireEvent.click(screen.getByTestId('product-row-102'));
  const row = screen.getByTestId('product-row-variation-105');
  expect(row.textContent).toContain('S');
  expect(row.textContent).toContain('White');
  expect(within(row).getByTestId('variation-price-105')).not.toBeNull();
  fireEvent.click(row);
  expect(onAddEntry).toHaveBeenCalledTimes(1);
  expect(onAddEntry.mock.calls[0][0].variant.id).toBe('105');
  expect(onSelect).not.toHaveBeenCalled();
  expect(variationRows()).toHaveLength(3);
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
});

test('expanded variation rows show their own SKU and barcode when the columns are on', () => {
  view({ browseBy: 'all', variationsStyle: 'inline', view: 'table',
    columns: CATALOGUE_COLUMNS.map(({ id, visible }) => ({ id, visible: visible || id === 'sku' || id === 'barcode' })) });
  renderView();
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(screen.getByTestId('variation-row-sku-105').textContent).toBe('MER-TEE-S-WHT');
  expect(screen.getByTestId('variation-row-barcode-105').textContent).toBe('2000000000145');
  expect(screen.getByTestId('variation-row-sku-104').textContent).toBe('MER-TEE-S-BLK');
});

test('expanded variation rows show a stock count pill with the default columns', () => {
  renderView();
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(screen.getByTestId('variation-row-stock-104').getAttribute('aria-label')).toBe('10 left');
});

test('expanded variation rows show Backorder or no stock pill when stock is unmanaged', () => {
  view({ browseBy: 'all', variationsStyle: 'inline', view: 'table', showOutOfStock: true });
  renderView([{ ...shirt, variation_docs: [
    { ...docs[0], stock_quantity: 0, stock_status: 'onbackorder' },
    { ...docs[1], manage_stock: false, stock_quantity: null, stock_status: 'instock' },
  ] }]);
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(screen.getByTestId('variation-row-stock-104').getAttribute('aria-label')).toBe('Backorder');
  expect(screen.getByTestId('product-row-variation-105')).not.toBeNull();
  expect(screen.queryByTestId('variation-row-stock-105')).toBeNull();
});

test('an expanded variation without a barcode shows an empty barcode cell', () => {
  view({ browseBy: 'all', variationsStyle: 'inline', view: 'table',
    columns: CATALOGUE_COLUMNS.map(({ id, visible }) => ({ id, visible: visible || id === 'barcode' })) });
  renderView([{ ...shirt, variation_docs: [{ ...docs[0], global_unique_id: '', barcode: '' }, docs[1], docs[2]] }]);
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(screen.getByTestId('variation-row-barcode-104').textContent).toBe('');
});

test("the in-cart column shows a variation row's own count", () => {
  renderView(undefined, { inCartCounts: new Map([['105', 2]]) });
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(screen.getByTestId('in-cart-variation-row-105').textContent).toBe('2');
});

test('an expanded variation add button adds once and keeps the rows expanded', () => {
  const { onAddEntry } = renderView(undefined, { inCartCounts: new Map() });
  fireEvent.click(screen.getByTestId('product-row-102'));
  fireEvent.click(screen.getByTestId('add-to-cart-variation-row-106'));
  expect(onAddEntry).toHaveBeenCalledTimes(1);
  expect(onAddEntry.mock.calls[0][0].variant.id).toBe('106');
  expect(toggle().getAttribute('aria-expanded')).toBe('true');
  expect(screen.queryByTestId('add-to-cart-row-102')).toBeNull();
});

test('the footer still counts products, not variation rows', () => {
  renderView([products[0], products[1], shirt]);
  search('T-Shirt');
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 1 of 3');
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(variationRows()).toHaveLength(3);
  expect(screen.getByTestId('data-table-count').textContent).toBe('Showing 1 of 3');
});

test('a product with an "Any" variant does not expand and keeps onSelect', () => {
  const { onSelect } = renderView([products[0], anySize]);
  expect(screen.getByTestId('product-options-102')).not.toBeNull();
  expect(screen.queryByTestId('variable-product-expand')).toBeNull();
  fireEvent.click(screen.getByTestId('product-row-102'));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(variationRows()).toEqual([]);
});

test('in grid view the inline style still opens the popover', () => {
  view({ browseBy: 'all', variationsStyle: 'inline' });
  renderView();
  fireEvent.click(screen.getByTestId('variable-product-tile-102'));
  expect(screen.getByTestId('variations-popover-102')).not.toBeNull();
  expect(variationRows()).toEqual([]);
});
