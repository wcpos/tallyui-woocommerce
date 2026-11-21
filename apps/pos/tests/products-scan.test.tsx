import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { ProductsScreen } from '../components/products-screen';
import { useWedgeScanner } from '../lib/scan/use-wedge-scanner';
import { dismissToast, getToasts } from '../lib/toast/toast';
import { scanLogger } from '../lib/scan/scan-log';

// v2's Products scan (WCPOS monorepo packages/core/src/screens/main/products/use-barcode.ts:19-63): "Barcode scanned:
// {barcode}" over "{count} product(s) found locally" (core.json common.barcode_scanned, product_found_locally_one /
// _other), info for 0 or 1 match and warn for more, then the code goes into the search.

const connector = createWooCommerceConnector();

function product(id: number, name: string, fields: Record<string, unknown> = {}) {
  return {
    id, name, type: 'simple', status: 'publish', sku: `SKU-${id}`, price: '10.00', regular_price: '10.00', sale_price: '',
    on_sale: false, purchasable: true, stock_status: 'instock', stock_quantity: null, manage_stock: false,
    categories: [], images: [], variations: [], meta_data: [], ...fields,
  };
}

const coded = (code: string) => ({ barcode: code, global_unique_id: code });
const catalogue = [
  product(1, 'Tea', coded('11112222')),
  product(2, 'Coffee', coded('33334444')),
  product(3, 'Mug', coded('33334444')),
  product(4, 'Hoodie', { type: 'variable', variations: [41], attributes: [], variation_docs: [{ id: 41, status: 'publish', price: '30.00', regular_price: '30.00', sale_price: '' }] }),
];

beforeEach(() => {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
});

afterEach(() => {
  cleanup();
  dismissToast();
  vi.restoreAllMocks();
});

/** The till under the Products route on the stack: it claimed the wedge first. */
function Till({ onScan }: { onScan(code: string): void }) {
  useWedgeScanner(onScan, true);
  return null;
}

function renderScreen() {
  const till = vi.fn();
  render(<><Till onScan={till} /><ProductsScreen products={catalogue} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} /></>,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
  return { till };
}

function wedge(code: string) {
  act(() => {
    for (const key of [...code, 'Enter']) document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });
}

const search = () => (screen.getByTestId('search-products') as HTMLInputElement).value;
const toasts = () => getToasts().map(({ title, description, type }) => ({ title, description, type }));
const rowIds = () => screen.queryAllByTestId(/^product-row-\d+$/).map(el => el.getAttribute('data-testid'));

test('a scan of a code with one match fills the search and toasts it as info', async () => {
  const { till } = renderScreen();
  wedge('11112222');
  expect(search()).toBe('11112222');
  expect(toasts()).toEqual([{ title: 'Barcode scanned: 11112222', description: '1 product found locally', type: 'info' }]);
  await waitFor(() => expect(rowIds()).toEqual(['product-row-1']));
  expect(till).not.toHaveBeenCalled();
});

test('a scan of a code with no match still fills the search and toasts the zero form as info', () => {
  renderScreen();
  wedge('99990000');
  expect(search()).toBe('99990000');
  expect(toasts()).toEqual([{ title: 'Barcode scanned: 99990000', description: '0 products found locally', type: 'info' }]);
});

test('a code shared by two products toasts the plural form as warning', () => {
  renderScreen();
  wedge('33334444');
  expect(search()).toBe('33334444');
  expect(toasts()).toEqual([{ title: 'Barcode scanned: 33334444', description: '2 products found locally', type: 'warning' }]);
});

test('while the display options panel is open a scan does nothing, and the till underneath does not take it', () => {
  const { till } = renderScreen();
  fireEvent.click(screen.getByTestId('products-bar-display'));
  expect(screen.getByTestId('products-display-options')).not.toBeNull();
  wedge('11112222');
  expect(toasts()).toEqual([]);
  expect(search()).toBe('');
  expect(till).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('products-display-close'));
  expect(screen.queryByTestId('products-display-options')).toBeNull();
  wedge('11112222');
  expect(search()).toBe('11112222');
  expect(toasts()).toHaveLength(1);
});

test('a scan while drilled into a variable product searches and drops the drill, as v2', () => {
  renderScreen();
  fireEvent.click(screen.getByTestId('product-variations-4'));
  expect(screen.getByTestId('products-crumb-row')).not.toBeNull();
  wedge('11112222');
  expect(search()).toBe('11112222');
  expect(screen.queryByTestId('products-crumb-row')).toBeNull();
  expect(toasts()).toHaveLength(1);
});

// v2 use-barcode.ts:35-59 logs each Products scan under ['wcpos', 'barcode', 'product']: "Barcode scanned: {barcode}"
// with { barcode, resultsCount }, info for 0 or 1 match and warn for more. vi.restoreAllMocks in afterEach drops the spies.
const logSpies = () => ({ info: vi.spyOn(scanLogger, 'info'), warn: vi.spyOn(scanLogger, 'warn') });

test('a scan with one match logs it as info', () => {
  const { info, warn } = logSpies();
  renderScreen();
  wedge('11112222');
  expect(info).toHaveBeenCalledWith('Barcode scanned: 11112222', { barcode: '11112222', resultsCount: 1 });
  expect(warn).not.toHaveBeenCalled();
});

test('a scan with no match logs a zero count as info', () => {
  const { info, warn } = logSpies();
  renderScreen();
  wedge('99990000');
  expect(info).toHaveBeenCalledWith('Barcode scanned: 99990000', { barcode: '99990000', resultsCount: 0 });
  expect(warn).not.toHaveBeenCalled();
});

test('a code shared by two products logs it as warn', () => {
  const { info, warn } = logSpies();
  renderScreen();
  wedge('33334444');
  expect(warn).toHaveBeenCalledWith('Barcode scanned: 33334444', { barcode: '33334444', resultsCount: 2 });
  expect(info).not.toHaveBeenCalled();
});

test('a scan dropped while the display options panel is open writes no log row', () => {
  const { info, warn } = logSpies();
  renderScreen();
  fireEvent.click(screen.getByTestId('products-bar-display'));
  expect(screen.getByTestId('products-display-options')).not.toBeNull();
  wedge('11112222');
  expect(info).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
});
