import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { ProductsScreen } from '../components/products-screen';
import fixtureProducts from './fixtures/products.json';

const connector = createWooCommerceConnector();

function product(id: number, name: string, fields: Record<string, unknown> = {}) {
  return {
    id, name, type: 'simple', status: 'publish', sku: `SKU-${id}`, price: '10.00', regular_price: '10.00', sale_price: '',
    on_sale: false, purchasable: true, stock_status: 'instock', stock_quantity: null, manage_stock: false,
    categories: [], images: [], variations: [], meta_data: [], ...fields,
  };
}

function setWidth(width: number) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

beforeEach(() => { setWidth(1000); });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderScreen(products: any[], onBack = vi.fn()) {
  // The chips' Select opens in a portal; the wrapper keeps the host across rerenders.
  const view = render(<ProductsScreen products={products} connector={connector} currency="USD" locale="en_US" onBack={onBack} />,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
  return { ...view, onBack };
}

const rowIds = () => screen.queryAllByTestId(/^product-row-/).map(el => el.getAttribute('data-testid'));
const text = (testID: string) => screen.getByTestId(testID).textContent;
const typeSearch = (value: string) => fireEvent.change(screen.getByTestId('search-products'), { target: { value } });

test('the table shows v2 headers in order, and rows come name asc whatever the input order', () => {
  renderScreen([product(3, 'Cappuccino'), product(1, 'Tea'), product(2, 'Americano')]);
  expect(screen.getByTestId('screen-products')).not.toBeNull();
  expect(screen.getByRole('heading', { name: 'Products' })).not.toBeNull();
  const headers = screen.getAllByRole('columnheader').map(header => header.textContent?.replace(/ [▲▼]$/, ''));
  expect(headers).toEqual(['Image', 'Name', 'Stock', 'Stock Status', 'Categories', 'Price', 'Regular Price', 'Sale Price']);
  expect(rowIds()).toEqual(['product-row-2', 'product-row-3', 'product-row-1']);
});

test('a variable product shows its variation count under the name, singular for one; a simple product shows none', () => {
  renderScreen([
    product(1, 'Hoodie', { type: 'variable', variations: [11, 12, 13] }),
    product(2, 'Mug', { type: 'variable', variations: [21] }),
    product(3, 'Sticker'),
  ]);
  expect(text('product-variations-1')).toBe('3 variations');
  expect(text('product-variations-2')).toBe('1 variation');
  expect(screen.queryByTestId('product-variations-3')).toBeNull();
});

test('stock: the managed quantity and its resolved badge; unmanaged shows a dash and follows stock_status', () => {
  renderScreen([
    product(1, 'Beans', { manage_stock: true, stock_quantity: 7, stock_status: 'instock' }),
    product(2, 'Filters', { manage_stock: true, stock_quantity: 0, stock_status: 'instock' }),
    product(3, 'Grinder', { manage_stock: false, stock_quantity: 4, stock_status: 'onbackorder' }),
  ]);
  expect(text('product-stock-quantity-1')).toBe('7');
  expect(text('product-stock-status-1')).toBe('In Stock');
  expect(text('product-stock-quantity-2')).toBe('0');
  expect(text('product-stock-status-2')).toBe('Out of Stock');
  expect(text('product-stock-quantity-3')).toBe('—');
  expect(text('product-stock-status-3')).toBe('On Backorder');
});

test('prices: price, regular and sale price as money in the store currency; an empty sale price shows nothing', () => {
  renderScreen([
    product(1, 'Beans', { price: '15', regular_price: '20', sale_price: '15', on_sale: true }),
    product(2, 'Filters', { price: '4.50', regular_price: '4.50', sale_price: '' }),
  ]);
  expect(text('product-price-1')).toBe('$15.00');
  expect(text('product-regular_price-1')).toBe('$20.00');
  expect(text('product-sale_price-1')).toBe('$15.00');
  expect(text('product-regular_price-2')).toBe('$4.50');
  expect(text('product-sale_price-2')).toBe('');
});

test('out-of-stock, unpurchasable and unpublished products still list', () => {
  renderScreen([
    product(1, 'Beans'),
    product(2, 'Filters', { manage_stock: true, stock_quantity: 0, stock_status: 'outofstock' }),
    product(3, 'Grinder', { purchasable: false }),
    product(4, 'Kettle', { status: 'draft' }),
  ]);
  expect(rowIds()).toEqual(['product-row-1', 'product-row-2', 'product-row-3', 'product-row-4']);
  expect(text('data-table-count')).toBe('4 products');
});

test('search: a SKU match narrows the list and the footer counts shown against total', async () => {
  renderScreen(fixtureProducts);
  expect(screen.getByTestId('search-products').getAttribute('placeholder')).toBe('Search products');
  expect(rowIds()).toHaveLength(3);
  expect(text('data-table-count')).toBe('3 products');
  typeSearch(fixtureProducts[0].sku);
  await waitFor(() => expect(rowIds()).toEqual([`product-row-${fixtureProducts[0].id}`]));
  expect(text('data-table-count')).toBe('Showing 1 of 3');
});

test('no match: "No products found", and Clear filters brings the rows back', async () => {
  renderScreen(fixtureProducts);
  typeSearch('no such product');
  await waitFor(() => expect(text('no-data-message-title')).toBe('No products found'));
  expect(rowIds()).toHaveLength(0);
  fireEvent.click(within(screen.getByTestId('no-data-message')).getByRole('button', { name: 'Clear filters' }));
  expect(rowIds()).toHaveLength(3);
  expect((screen.getByTestId('search-products') as HTMLInputElement).value).toBe('');
});

test('no products: "No products yet" with its description', () => {
  renderScreen([]);
  expect(text('no-data-message-title')).toBe('No products yet');
  expect(text('no-data-message-description')).toBe('Products you add to the store will appear here.');
  expect(screen.queryByTestId('data-table-count')).toBeNull();
});

test('live: rerendering with a new products array adds the new row', () => {
  const first = [product(1, 'Beans')];
  const { rerender } = renderScreen(first);
  expect(rowIds()).toEqual(['product-row-1']);
  expect(text('data-table-count')).toBe('1 product');
  rerender(<ProductsScreen products={[...first, product(2, 'Aeropress')]} connector={connector} currency="USD" locale="en_US" onBack={() => {}} />);
  expect(rowIds()).toEqual(['product-row-2', 'product-row-1']);
  expect(text('data-table-count')).toBe('2 products');
});

test('narrow window: a list row per product with name, price and stock badge; Back calls onBack', () => {
  setWidth(400);
  const { onBack } = renderScreen([
    product(1, 'Tea', { price: '3' }),
    product(2, 'Beans', { price: '12.5', manage_stock: true, stock_quantity: 0 }),
  ]);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.getAllByTestId(/^products-row-/).map(el => el.getAttribute('data-testid'))).toEqual(['products-row-2', 'products-row-1']);
  const beans = within(screen.getByTestId('products-row-2'));
  expect(beans.getByText('Beans')).not.toBeNull();
  expect(beans.getByText('$12.50')).not.toBeNull();
  expect(beans.getByText('Out of Stock')).not.toBeNull();
  const tea = within(screen.getByTestId('products-row-1'));
  expect(tea.getByText('Tea')).not.toBeNull();
  expect(tea.getByText('$3.00')).not.toBeNull();
  expect(tea.getByText('In Stock')).not.toBeNull();
  fireEvent.click(screen.getByTestId('products-back'));
  expect(onBack).toHaveBeenCalledOnce();
});

const [espresso, coldBrew] = fixtureProducts;
const onSalePill = () => screen.getByTestId('filter-pill-on_sale');

test('the chips start off: every product lists, out of stock too, and the stock chip reads Stock Status', () => {
  renderScreen([product(1, 'Beans'), product(2, 'Filters', { stock_status: 'outofstock' }), product(3, 'Grinder', { stock_status: 'onbackorder' })]);
  expect(rowIds()).toEqual(['product-row-1', 'product-row-2', 'product-row-3']);
  expect(text('data-table-count')).toBe('3 products');
  expect(text('filter-pill-stock_status')).toBe('Stock Status');
  expect(screen.queryByTestId('filter-pill-remove-stock_status')).toBeNull();
  expect(onSalePill().getAttribute('aria-pressed')).toBe('false');
});

test('On Sale leaves the on-sale products and the footer follows; pressing it again brings every product back', () => {
  renderScreen(fixtureProducts);
  fireEvent.click(onSalePill());
  expect(onSalePill().getAttribute('aria-pressed')).toBe('true');
  expect(rowIds()).toEqual([`product-row-${coldBrew.id}`]);
  expect(text('data-table-count')).toBe('Showing 1 of 3');
  fireEvent.click(onSalePill());
  expect(onSalePill().getAttribute('aria-pressed')).toBe('false');
  expect(rowIds()).toHaveLength(3);
  expect(text('data-table-count')).toBe('3 products');
});

test('Category leaves that category, and with a search only products that match both', async () => {
  renderScreen(fixtureProducts);
  fireEvent.click(screen.getByTestId('filter-pill-categories'));
  fireEvent.click(screen.getByTestId('category-option-25'));
  expect(text('filter-pill-categories')).toBe('Coffee');
  expect(rowIds()).toEqual([`product-row-${coldBrew.id}`, `product-row-${espresso.id}`]);
  expect(text('data-table-count')).toBe('Showing 2 of 3');
  typeSearch(espresso.sku);
  await waitFor(() => expect(rowIds()).toEqual([`product-row-${espresso.id}`]));
  expect(text('data-table-count')).toBe('Showing 1 of 3');
});

test('a chip and a search that leave nothing: "No products found", and Clear filters clears both', async () => {
  renderScreen(fixtureProducts);
  fireEvent.click(onSalePill());
  typeSearch(espresso.sku);
  await waitFor(() => expect(text('no-data-message-title')).toBe('No products found'));
  fireEvent.click(within(screen.getByTestId('no-data-message')).getByRole('button', { name: 'Clear filters' }));
  expect(rowIds()).toHaveLength(3);
  expect(text('data-table-count')).toBe('3 products');
  expect((screen.getByTestId('search-products') as HTMLInputElement).value).toBe('');
  expect(onSalePill().getAttribute('aria-pressed')).toBe('false');
});

test('the Category chip offers every product\'s categories, not only the shown ones', () => {
  renderScreen(fixtureProducts);
  fireEvent.click(onSalePill());
  expect(rowIds()).toEqual([`product-row-${coldBrew.id}`]);
  fireEvent.click(screen.getByTestId('filter-pill-categories'));
  // Merch (27) is carried only by the T-Shirt, which On Sale hides.
  expect(screen.getAllByTestId(/^category-option-/).map(el => el.getAttribute('data-testid')))
    .toEqual(['category-option-25', 'category-option-27']);
});
