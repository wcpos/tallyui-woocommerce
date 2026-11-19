import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { ProductsScreen } from '../components/products-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { memoryStorage } from './memory-storage';

// v2's Clear all at the end of the chip row: the till (pos/products/filter-bar/filter-bar.tsx:493-537, testID
// filter-bar-clear-all) and the Products screen (components/product/filter-bar/index.tsx:25-31,61-65, testID
// products-filter-clear-all), shown once two filters are on; copy core.json:1213 "Clear all".
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  // The till tests drive the flat product grid, so they browse All products.
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([{ id: 'merch', type: 'quick', label: 'Merch',
    conditions: [{ field: 'categories', value: [30] }] }]));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

const renderTill = () => render(<><CatalogueView {...props} /><PortalHost /></>);
const tillClear = () => screen.queryByTestId('filter-bar-clear-all');
const saveAs = () => screen.queryByTestId('filter-bar-save-as-button');
const search = () => screen.getByPlaceholderText('Search products') as HTMLInputElement;

function pickCategory(id: number): void {
  fireEvent.click(screen.getByTestId('filter-pill-categories'));
  fireEvent.click(screen.getByTestId(`category-option-${id}`));
}

/** True when `a` comes before `b` in the document. */
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

test('till: Clear all shows only once two filters are on', () => {
  renderTill();
  expect(tillClear()).toBeNull();
  fireEvent.change(search(), { target: { value: 'Cold' } });
  expect(tillClear()).toBeNull();
  fireEvent.change(search(), { target: { value: '' } });
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  expect(saveAs()).not.toBeNull();
  expect(tillClear()).toBeNull();
  pickCategory(25);
  const clear = within(screen.getByTestId('catalogue-chip-row')).getByTestId('filter-bar-clear-all');
  expect(clear.textContent).toBe('Clear all');
  expect(before(screen.getByTestId('quick-filter-merch'), clear)).toBe(true);
  expect(before(clear, saveAs()!)).toBe(true);
});

test('till: Clear all turns every filter and the search off', () => {
  renderTill();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  pickCategory(25);
  fireEvent.change(search(), { target: { value: 'Cold' } });
  fireEvent.click(tillClear()!);
  expect(screen.getByTestId('filter-pill-on_sale').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Category');
  expect(search().value).toBe('');
  expect(tillClear()).toBeNull();
  expect(saveAs()).toBeNull();
  // Every product is back: nothing narrows the grid.
  for (const doc of products) expect(screen.queryAllByText(doc.name).length).toBeGreaterThan(0);
});

function product(id: number, name: string, fields: Record<string, unknown> = {}) {
  return {
    id, name, type: 'simple', status: 'publish', sku: `SKU-${id}`, price: '10.00', regular_price: '10.00', sale_price: '',
    on_sale: false, purchasable: true, stock_status: 'instock', stock_quantity: null, manage_stock: false,
    categories: [], images: [], variations: [], meta_data: [], ...fields,
  };
}

const hats = { id: 5, name: 'Hats' };
const shelf = [
  product(1, 'Wool Hat', { on_sale: true, categories: [hats] }),
  product(2, 'Wool Scarf', { on_sale: true }),
  product(3, 'Cap', { categories: [hats] }),
];

function renderProducts() {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1000, height: 800, scale: 1, fontScale: 1 });
  render(<ProductsScreen products={shelf} connector={createWooCommerceConnector()} currency="USD" locale="en_US" onBack={vi.fn()} />,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
}
const productsClear = () => screen.queryByTestId('products-filter-clear-all');

test('products: Clear all shows only once two filters are on', () => {
  renderProducts();
  expect(productsClear()).toBeNull();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  expect(productsClear()).toBeNull();
  pickCategory(5);
  const clear = within(screen.getByTestId('products-filter-row')).getByTestId('products-filter-clear-all');
  expect(clear.textContent).toBe('Clear all');
});

test('products: Clear all turns the filters off and keeps the search', async () => {
  renderProducts();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  pickCategory(5);
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'Wool' } });
  fireEvent.click(productsClear()!);
  expect(screen.getByTestId('filter-pill-on_sale').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByTestId('filter-pill-categories').textContent).toBe('Category');
  expect(productsClear()).toBeNull();
  expect((screen.getByTestId('search-products') as HTMLInputElement).value).toBe('Wool');
  // The search still narrows the table once it settles: the two Wool products, not the Cap.
  await waitFor(() => expect(screen.queryByTestId('product-row-3')).toBeNull());
  expect(screen.queryByTestId('product-row-1')).not.toBeNull();
  expect(screen.queryByTestId('product-row-2')).not.toBeNull();
});
