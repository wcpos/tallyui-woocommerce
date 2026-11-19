// v2's Product column display switches (WCPOS monorepo `contexts/ui-settings/initial-settings.json:261-277`,
// `components/ui-settings/columns-form.tsx:82-143`, `products/cells/name.tsx:48-50`): SKU, Barcode and Attributes,
// all off, nested one gutter in under the Product switch while that column is shown; each adds its line under the name.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { AreaDisplayOptions } from '../components/area-display-options';
import { COUPONS_COLUMNS } from '../components/coupons-screen';
import { CUSTOMERS_COLUMNS } from '../components/customers-screen';
import { ORDERS_COLUMNS } from '../components/orders-table';
import { PRODUCTS_COLUMNS, ProductsScreen } from '../components/products-screen';
import { areaColumnRows, areaColumnsKey, normalizeAreaColumns, saveAreaColumns } from '../lib/area-columns';
import { classesOf } from './classes-of';
import { memoryStorage } from './memory-storage';

const connector = createWooCommerceConnector();
const KEYS = ['sku', 'barcode', 'attributes'] as const;

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function product(id: number, name: string) {
  return {
    id, name, type: 'simple', status: 'publish', sku: `SKU-${id}`, barcode: `0000${id}`, price: '10.00', regular_price: '12.00',
    sale_price: '', on_sale: false, purchasable: true, stock_status: 'instock', stock_quantity: null, manage_stock: false,
    categories: [], tags: [], images: [], variations: [], meta_data: [], date_modified_gmt: '2026-10-05T12:00:00',
    attributes: [
      { id: 1, name: 'Origin', position: 0, visible: true, variation: false, options: ['Kenya', 'Peru'] },
      { id: 2, name: 'Size', position: 1, visible: true, variation: true, options: ['Small', 'Large'] },
    ],
  };
}

function renderProducts() {
  render(<ProductsScreen products={[product(1, 'Tea'), product(2, 'Americano')]} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} />,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
}

function openPanel(area: string) {
  fireEvent.click(screen.getByTestId(`${area}-bar-display`));
  return screen.getByTestId(`${area}-display-options`);
}

const switchIds = (panel: HTMLElement) => Array.from(panel.querySelectorAll('[role="switch"]')).map(node => node.getAttribute('data-testid'));
const nested = (key: string) => `products-display-column-name-${key}`;

test('the Product column carries SKU, Barcode and Attributes, off, one gutter in, only while it is shown', () => {
  renderProducts();
  const panel = openPanel('products');
  const ids = switchIds(panel);
  const at = ids.indexOf('products-display-column-name');
  expect(ids.slice(at, at + 5)).toEqual(['products-display-column-name', ...KEYS.map(nested), 'products-display-column-type']);
  const group = screen.getByTestId('products-display-column-name-display');
  expect(classesOf('products-display-column-name-display')).toContain('pl-12');
  for (const key of KEYS) {
    expect(group.contains(screen.getByTestId(nested(key)))).toBe(true);
    expect(screen.getByTestId(nested(key)).getAttribute('aria-checked')).toBe('false');
  }
  expect(Array.from(group.querySelectorAll('[role="switch"]')).map(node => node.getAttribute('aria-label')))
    .toEqual(['Show SKU', 'Show Barcode', 'Show Attributes']);
  expect(group.textContent).toBe('SKUBarcodeAttributes');

  fireEvent.click(screen.getByTestId('products-display-column-name'));
  expect(screen.queryByTestId('products-display-column-name-display')).toBeNull();
  for (const key of KEYS) expect(screen.queryByTestId(nested(key))).toBeNull();
  fireEvent.click(screen.getByTestId('products-display-column-name'));
  expect(screen.getByTestId(nested('sku')).getAttribute('aria-checked')).toBe('false');
});

test.each([
  ['sku', 'product-name-sku-1', 'SKU-1'],
  ['barcode', 'product-name-barcode-1', '00001'],
  ['attributes', 'product-plain-attributes-1', 'Origin: Kenya, Peru'],
])('each nested switch draws its line under the product name: %s', (key, testID, text) => {
  renderProducts();
  expect(screen.queryByTestId(testID)).toBeNull();
  openPanel('products');
  fireEvent.click(screen.getByTestId(nested(key)));
  expect(screen.getByTestId(nested(key)).getAttribute('aria-checked')).toBe('true');
  const line = screen.getByTestId(testID);
  expect(line.textContent).toBe(text);
  expect(screen.getByTestId('product-cell-name-1').contains(line)).toBe(true);
  // Only the line switched on is drawn.
  for (const other of ['product-name-sku-1', 'product-name-barcode-1', 'product-plain-attributes-1'].filter(id => id !== testID))
    expect(screen.queryByTestId(other)).toBeNull();
  if (key === 'attributes') expect(screen.queryByTestId('product-plain-attribute-1-Size')).toBeNull();
  // The SKU column itself stays off: the line is the name cell's, not a column.
  expect(screen.queryByTestId('product-sku-1')).toBeNull();
});

test('the choice survives a remount and Restore turns all three off', () => {
  renderProducts();
  openPanel('products');
  fireEvent.click(screen.getByTestId(nested('sku')));
  fireEvent.click(screen.getByTestId(nested('attributes')));
  const stored = JSON.parse(localStorage.getItem(areaColumnsKey('products'))!);
  expect(stored.find((row: { id: string }) => row.id === 'name')).toEqual({ id: 'name', visible: true,
    display: [{ id: 'sku', visible: true }, { id: 'barcode', visible: false }, { id: 'attributes', visible: true }] });
  expect(stored.find((row: { id: string }) => row.id === 'price')).toEqual({ id: 'price', visible: true, display: [{ id: 'tax', visible: false }] });

  cleanup();
  renderProducts();
  expect(screen.getByTestId('product-name-sku-1').textContent).toBe('SKU-1');
  expect(within(screen.getByTestId('product-cell-name-2')).getByTestId('product-plain-attributes-2').textContent).toBe('Origin: Kenya, Peru');
  openPanel('products');
  expect(KEYS.map(key => screen.getByTestId(nested(key)).getAttribute('aria-checked'))).toEqual(['true', 'false', 'true']);

  fireEvent.click(screen.getByTestId('products-display-restore'));
  expect(KEYS.map(key => screen.getByTestId(nested(key)).getAttribute('aria-checked'))).toEqual(['false', 'false', 'false']);
  expect(screen.queryByTestId('product-name-sku-1')).toBeNull();
  expect(screen.queryByTestId('product-plain-attributes-1')).toBeNull();
});

test('a column switch keeps the display lines, and Product hidden draws none of them in the table', () => {
  renderProducts();
  openPanel('products');
  fireEvent.click(screen.getByTestId(nested('barcode')));
  fireEvent.click(screen.getByTestId('products-display-column-price'));
  expect(screen.getByTestId('product-name-barcode-1').textContent).toBe('00001');
  fireEvent.click(screen.getByTestId('products-display-column-name'));
  expect(screen.queryByTestId('product-name-barcode-1')).toBeNull();
  fireEvent.click(screen.getByTestId('products-display-column-name'));
  expect(screen.getByTestId(nested('barcode')).getAttribute('aria-checked')).toBe('true');
  expect(screen.getByTestId('product-name-barcode-1').textContent).toBe('00001');
});

test.each([
  ['orders', ORDERS_COLUMNS], ['customers', CUSTOMERS_COLUMNS], ['coupons', COUPONS_COLUMNS],
] as const)('%s draws no nested switches, and plain stored rows stay readable', (area, columns) => {
  render(<><AreaDisplayOptions area={area} columns={columns} settings={areaColumnRows(columns)} onChange={vi.fn()} /><PortalHost /></>);
  const panel = openPanel(area);
  expect(panel.querySelector('[data-testid$="-display"]')).toBeNull();
  expect(switchIds(panel)).toEqual(columns.map(({ id }) => `${area}-display-column-${id}`));

  // The area's save stores plain `{ id, visible }` rows, as before.
  const storage = memoryStorage();
  saveAreaColumns(area, columns, storage);
  expect(JSON.parse(storage.getItem(areaColumnsKey(area))!)).toEqual(columns.map(({ id, visible }) => ({ id, visible })));
});

test('a products array saved before display lines existed reads their defaults; a bad line takes its default', () => {
  const plain = PRODUCTS_COLUMNS.map(({ id }) => ({ id, visible: id !== 'image' }));
  const read = normalizeAreaColumns(plain, PRODUCTS_COLUMNS);
  expect(read.find(row => row.id === 'image')).toEqual({ id: 'image', visible: false });
  expect(read.find(row => row.id === 'name')).toEqual({ id: 'name', visible: true,
    display: [{ id: 'sku', visible: false }, { id: 'barcode', visible: false }, { id: 'attributes', visible: false }] });
  // A malformed display line takes its default; an unknown one is dropped.
  const odd = normalizeAreaColumns([{ id: 'name', visible: true, display: [{ id: 'sku', visible: 'yes' }, { id: 'barcode', visible: true }, { id: 'gtin', visible: true }] }], PRODUCTS_COLUMNS);
  expect(odd.find(row => row.id === 'name')?.display).toEqual([{ id: 'sku', visible: false }, { id: 'barcode', visible: true }, { id: 'attributes', visible: false }]);
});
