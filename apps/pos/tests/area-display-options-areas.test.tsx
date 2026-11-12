// v2's display options on Customers, Coupons and Products (DEMO-PARITY C5, D13, D12): the bar's settings icon before
// the bell opens "<Area> Settings" with one switch per column in v2's order and its defaults; a switch hides or shows
// the column's header and cells, and Restore Default Settings sets the defaults back.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { getRxStorageMemory } from 'rxdb/plugins/storage-memory';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import type { Customer } from '@tallyui/core';
import { createTallyDatabase } from '@tallyui/database';
import { PortalHost } from '@tallyui/primitives';
import { CouponsScreen } from '../components/coupons-screen';
import { CustomersScreen } from '../components/customers-screen';
import { ProductsScreen } from '../components/products-screen';
import { areaColumnsKey, type AreaId } from '../lib/area-columns';
import type { CustomerSource } from '../lib/customers/customer-source';
import { memoryStorage } from './memory-storage';

const connector = createWooCommerceConnector();

function setWidth(width: number) {
  vi.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width, height: 800, scale: 1, fontScale: 1 });
}

beforeEach(() => {
  setWidth(1000);
  vi.stubGlobal('localStorage', memoryStorage());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** The bar's controls among `ids`, in the order they are drawn. */
function barOrder(area: AreaId, ids: string[]): (string | null)[] {
  return Array.from(screen.getByTestId(`${area}-bar-controls`).querySelectorAll('[data-testid]'))
    .map(node => node.getAttribute('data-testid')).filter(id => ids.includes(id!));
}

/** The table's header labels, without the empty avatar and chevron heads or the products sort arrow. */
const headers = () => screen.getAllByRole('columnheader').map(node => node.textContent?.replace(/ [▲▼]$/, '')).filter(Boolean);

function openPanel(area: AreaId) {
  fireEvent.click(screen.getByTestId(`${area}-bar-display`));
  return screen.getByTestId(`${area}-display-options`);
}

function expectSwitches(area: AreaId, panel: HTMLElement, title: string, columns: [string, boolean][]) {
  expect(within(panel).getByText(title)).not.toBeNull();
  const switches = Array.from(panel.querySelectorAll('[role="switch"]'));
  expect(switches.map(node => node.getAttribute('data-testid'))).toEqual(columns.map(([id]) => `${area}-display-column-${id}`));
  expect(switches.map(node => node.getAttribute('aria-checked'))).toEqual(columns.map(([, on]) => String(on)));
}

const toggle = (area: AreaId, id: string) => fireEvent.click(screen.getByTestId(`${area}-display-column-${id}`));

// --- Customers ---------------------------------------------------------------------------------------------------

const gee: Customer = { id: '7', name: 'Gee Four', firstName: 'Gee', lastName: 'Four', email: 'gee@example.invalid', company: 'Four Co' };
const ada: Customer = { id: '9', name: 'Ada Lovelace', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.invalid' };
const cy: Customer = { id: '11', name: 'Cy Brown', firstName: 'Cy', lastName: 'Brown', email: 'cy@example.invalid' };

async function renderCustomers(customers: Customer[] = [gee, ada]) {
  const source: CustomerSource = { search: vi.fn(async () => customers), create: vi.fn() };
  render(<><CustomersScreen source={source} onBack={vi.fn()} createBlockedReason={undefined} /><PortalHost /></>);
  await screen.findByTestId('customers-body');
}
const customerRow = (id: string) => within(screen.getByTestId(`customers-row-${id}`));
const customerIds = () => screen.getAllByTestId(/^customers-row-/).map(node => node.getAttribute('data-testid'));

test('Customers: the add button, then the display options, then the bell', async () => {
  await renderCustomers();
  expect(barOrder('customers', ['customers-add-button', 'customers-bar-display', 'customers-bar-bell']))
    .toEqual(['customers-add-button', 'customers-bar-display', 'customers-bar-bell']);
  expect(screen.getByTestId('customers-bar-display').getAttribute('aria-label')).toBe('Display options');
});

test("Customers: Customer Settings lists v2's columns in order, ID off by default", async () => {
  await renderCustomers();
  expectSwitches('customers', openPanel('customers'), 'Customer Settings', [
    ['avatar_url', true], ['id', false], ['first_name', true], ['last_name', true], ['email', true], ['billing', true],
  ]);
  expect(headers()).toEqual(['First Name', 'Last Name', 'Email', 'Billing Address']);
});

test('Customers: switching Email off drops its header and cells, and Restore brings it back', async () => {
  await renderCustomers();
  expect(customerRow('7').queryByText('gee@example.invalid')).not.toBeNull();
  openPanel('customers');
  toggle('customers', 'email');
  expect(headers()).toEqual(['First Name', 'Last Name', 'Billing Address']);
  expect(customerRow('7').queryByText('gee@example.invalid')).toBeNull();
  expect(customerRow('7').getByText('Four Co')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(areaColumnsKey('customers'))!).find((row: { id: string }) => row.id === 'email'))
    .toEqual({ id: 'email', visible: false });
  fireEvent.click(screen.getByTestId('customers-display-restore'));
  expect(headers()).toEqual(['First Name', 'Last Name', 'Email', 'Billing Address']);
  expect(customerRow('7').getByText('gee@example.invalid')).not.toBeNull();
});

test('Customers: ID switched on draws its header and the customer id', async () => {
  await renderCustomers();
  expect(customerRow('7').queryByText('7')).toBeNull();
  openPanel('customers');
  toggle('customers', 'id');
  expect(headers()).toEqual(['ID', 'First Name', 'Last Name', 'Email', 'Billing Address']);
  expect(customerRow('7').getByText('7')).not.toBeNull();
  expect(customerRow('9').getByText('9')).not.toBeNull();
});

test('Customers: with Last Name off, First Name still sorts both ways', async () => {
  await renderCustomers([ada, gee, cy]);
  openPanel('customers');
  toggle('customers', 'last_name');
  fireEvent.click(screen.getByTestId('customers-display-close'));
  expect(screen.queryByTestId('data-table-header-last_name')).toBeNull();
  fireEvent.click(screen.getByTestId('data-table-header-first_name'));
  expect(screen.getByTestId('data-table-sort-first_name-asc')).not.toBeNull();
  expect(customerIds()).toEqual(['customers-row-9', 'customers-row-11', 'customers-row-7']);
  fireEvent.click(screen.getByTestId('data-table-header-first_name'));
  expect(screen.getByTestId('data-table-sort-first_name-desc')).not.toBeNull();
  expect(customerIds()).toEqual(['customers-row-7', 'customers-row-11', 'customers-row-9']);
});

// --- Coupons -----------------------------------------------------------------------------------------------------

const couponDocs = [
  { uuid: 'c-1', id: 1, code: '10off', discount_type: 'percent', amount: '10', description: 'Ten percent off', status: 'publish',
    date_created_gmt: '2026-03-01T10:00:00', date_modified_gmt: '2026-04-02T10:00:00', usage_count: 3, usage_limit: 10, used_by: [] },
  { uuid: 'c-2', id: 2, code: 'drafty', discount_type: 'fixed_cart', amount: '5', description: 'Not yet', status: 'draft',
    date_created_gmt: '2026-02-01T10:00:00', usage_count: 0, used_by: [] },
];

async function renderCoupons() {
  const db = await createTallyDatabase({ connector, name: `area_display_${crypto.randomUUID()}`, storage: getRxStorageMemory() });
  await db.coupons.bulkInsert(couponDocs);
  render(<><CouponsScreen coupons={db.coupons} currency="USD" locale="en_US" onBack={vi.fn()} /><PortalHost /></>);
  await screen.findByTestId('coupons-row-10off');
  return db;
}
const couponHeaders = () => screen.getAllByTestId(/^coupons-header-/).map(node => node.textContent);
const COUPON_DEFAULT_HEADERS = ['Active', 'Code', 'Amount', 'Type', 'Description', 'Usage', 'Expiry Date'];

test('Coupons: the display options sit before the bell', async () => {
  const db = await renderCoupons();
  expect(barOrder('coupons', ['coupons-bar-display', 'coupons-bar-bell'])).toEqual(['coupons-bar-display', 'coupons-bar-bell']);
  await db.close();
});

test("Coupons: Coupon Settings lists v2's columns in order, Status and the two dates off by default", async () => {
  const db = await renderCoupons();
  expectSwitches('coupons', openPanel('coupons'), 'Coupon Settings', [
    ['active', true], ['code', true], ['amount', true], ['discount_type', true], ['description', true], ['usage_count', true],
    ['date_expires_gmt', true], ['status', false], ['date_created_gmt', false], ['date_modified_gmt', false],
  ]);
  expect(couponHeaders()).toEqual(COUPON_DEFAULT_HEADERS);
  await db.close();
});

test('Coupons: switching Usage off drops its header and cells, and Restore brings it back', async () => {
  const db = await renderCoupons();
  expect(screen.getByTestId('coupon-usage-10off').textContent).toBe('3 / 10');
  openPanel('coupons');
  toggle('coupons', 'usage_count');
  expect(couponHeaders()).toEqual(COUPON_DEFAULT_HEADERS.filter(label => label !== 'Usage'));
  expect(screen.queryByTestId('coupon-usage-10off')).toBeNull();
  expect(within(screen.getByTestId('coupons-row-10off')).getByText('Ten percent off')).not.toBeNull();
  fireEvent.click(screen.getByTestId('coupons-display-restore'));
  expect(couponHeaders()).toEqual(COUPON_DEFAULT_HEADERS);
  expect(screen.getByTestId('coupon-usage-10off').textContent).toBe('3 / 10');
  await db.close();
});

test('Coupons: Status and Date Created switched on draw v2 status words and the created day', async () => {
  const db = await renderCoupons();
  expect(screen.queryByTestId('coupon-status-10off')).toBeNull();
  openPanel('coupons');
  toggle('coupons', 'status');
  toggle('coupons', 'date_created_gmt');
  expect(couponHeaders()).toEqual([...COUPON_DEFAULT_HEADERS, 'Status', 'Date Created']);
  expect(screen.getByTestId('coupon-status-10off').textContent).toBe('Published');
  expect(screen.getByTestId('coupon-status-drafty').textContent).toBe('Draft');
  // The created day reads as the expiry date does: the locale's day, month and year, no time.
  expect(screen.getByTestId('coupon-date_created_gmt-10off').textContent).toBe('Mar 1, 2026');
  expect(screen.queryByTestId('coupon-date_modified_gmt-10off')).toBeNull();
  await db.close();
});

// --- Products ----------------------------------------------------------------------------------------------------

function product(id: number, name: string, fields: Record<string, unknown> = {}) {
  return {
    id, name, type: 'simple', status: 'publish', sku: `SKU-${id}`, price: '10.00', regular_price: '12.00', sale_price: '',
    on_sale: false, purchasable: true, stock_status: 'instock', stock_quantity: null, manage_stock: false,
    categories: [], tags: [{ id: 4, name: 'Hot' }], images: [], variations: [], meta_data: [],
    date_modified_gmt: '2026-10-05T12:00:00', ...fields,
  };
}

function renderProducts() {
  render(<ProductsScreen products={[product(1, 'Tea'), product(2, 'Americano')]} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} />,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
}
// v2's image column is unlabelled (initial-settings.json `hideLabel`), so `headers()` drops its empty head.
const PRODUCT_DEFAULT_HEADERS = ['Product', 'Stock', 'Stock Status', 'Categories', 'Price', 'Regular Price', 'Sale Price'];

test('Products: the display options sit before the bell', () => {
  renderProducts();
  expect(barOrder('products', ['products-bar-display', 'products-bar-bell'])).toEqual(['products-bar-display', 'products-bar-bell']);
});

test("Products: Product Settings lists v2's columns in order with v2's defaults", () => {
  renderProducts();
  expectSwitches('products', openPanel('products'), 'Product Settings', [
    ['image', true], ['id', false], ['name', true], ['type', false], ['sku', false], ['barcode', false],
    ['stock_quantity', true], ['stock_status', true], ['categories', true], ['tags', false], ['price', true],
    ['regular_price', true], ['sale_price', true], ['date_modified_gmt', false],
  ]);
  expect(headers()).toEqual(PRODUCT_DEFAULT_HEADERS);
});

test('Products: switching Price off drops its header and cells, and Restore brings it back', () => {
  renderProducts();
  expect(screen.getByTestId('product-price-1').textContent).toBe('$10.00');
  openPanel('products');
  toggle('products', 'price');
  expect(headers()).toEqual(PRODUCT_DEFAULT_HEADERS.filter(label => label !== 'Price'));
  expect(screen.queryByTestId('product-price-1')).toBeNull();
  expect(screen.getByTestId('product-regular_price-1').textContent).toBe('$12.00');
  fireEvent.click(screen.getByTestId('products-display-restore'));
  expect(headers()).toEqual(PRODUCT_DEFAULT_HEADERS);
  expect(screen.getByTestId('product-price-1').textContent).toBe('$10.00');
});

test('Products: SKU, Tags and Date Modified switched on draw their headers in place and the doc values', () => {
  renderProducts();
  expect(screen.queryByTestId('product-sku-1')).toBeNull();
  openPanel('products');
  toggle('products', 'sku');
  toggle('products', 'tags');
  toggle('products', 'date_modified_gmt');
  expect(headers()).toEqual(['Product', 'SKU', 'Stock', 'Stock Status', 'Categories', 'Tags', 'Price', 'Regular Price',
    'Sale Price', 'Date Modified']);
  expect(screen.getByTestId('product-sku-1').textContent).toBe('SKU-1');
  expect(screen.getByTestId('product-sku-2').textContent).toBe('SKU-2');
  expect(screen.getByTestId('product-tags-1').textContent).toBe('Hot');
  expect(screen.getByTestId('product-date_modified_gmt-1').textContent).toBe('Oct 5, 2026');
});

test('Products: a narrow window keeps the trigger and its list', async () => {
  setWidth(500);
  renderProducts();
  expect(screen.getByTestId('products-bar-display')).not.toBeNull();
  openPanel('products');
  toggle('products', 'price');
  await waitFor(() => expect(screen.getAllByTestId(/^products-row-/).map(node => node.getAttribute('data-testid')))
    .toEqual(['products-row-2', 'products-row-1']));
  expect(within(screen.getByTestId('products-row-1')).getByText('$10.00')).not.toBeNull();
});
