import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as ReactNative from 'react-native';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { ProductsScreen } from '../components/products-screen';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { memoryStorage } from './memory-storage';
import products from './fixtures/products.json';
import variations from './fixtures/variations.json';

const connector = createWooCommerceConnector();
const [espresso, coldBrew] = products;
// The T-Shirt's attributes as the connector syncs them, plus one that is not used for variations.
const attributes = [
  { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
  { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
  { id: 0, name: 'Fabric', position: 2, visible: true, variation: false, options: ['Cotton'] },
];
// 104 S/Black, 105 S/White, 106 M/Black; 105 is sold out here.
const docs = variations.documents.map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }))
  .map(doc => doc.id === 105 ? { ...doc, stock_quantity: 0 } : doc);
const shirt = { ...products[2], attributes, variation_docs: docs };
const catalogue = [espresso, coldBrew, shirt];

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

function renderScreen(items: any[] = catalogue) {
  return render(<ProductsScreen products={items} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} />,
    { wrapper: ({ children }) => <>{children}<PortalHost /></> });
}

const inline = () => localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ variationsStyle: 'inline' }));
const toggle = () => fireEvent.click(screen.getByTestId(`product-variations-${shirt.id}`));
const expanded = () => screen.getByTestId('variable-product-expand').getAttribute('aria-expanded');
const variationIds = () => within(screen.getByTestId('products-body')).queryAllByTestId(/^products-variation-row-/)
  .map(node => Number(node.getAttribute('data-testid')!.replace('products-variation-row-', '')));
const crumb = () => screen.queryByTestId('products-crumb-row');

test('the Variations control sits above Columns and writes the shared view style', () => {
  renderScreen();
  fireEvent.click(screen.getByTestId('products-bar-display'));
  const control = screen.getByTestId('products-variations-style');
  expect(within(control).getByRole('radio', { name: 'Open in place' }).getAttribute('aria-checked')).toBe('true');
  const rows = within(control).getByRole('radio', { name: 'Expanded rows' });
  expect(control.compareDocumentPosition(screen.getByTestId('products-display-columns')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(rows);
  expect(JSON.parse(localStorage.getItem(CATALOGUE_VIEW_KEY)!).variationsStyle).toBe('inline');
  fireEvent.click(screen.getByTestId('products-display-close'));
  expect(expanded()).toBe('false');
});

test('inline expands and collapses the variations under the table with no crumb', () => {
  inline();
  renderScreen();
  expect(expanded()).toBe('false');
  toggle();
  expect(variationIds()).toEqual([104, 105, 106]);
  expect(crumb()).toBeNull();
  expect(expanded()).toBe('true');
  toggle();
  expect(variationIds()).toEqual([]);
  expect(expanded()).toBe('false');
});

test('the In stock chip excludes the sold-out variation from expanded rows', () => {
  inline();
  renderScreen();
  fireEvent.click(screen.getByTestId('filter-pill-stock_status'));
  fireEvent.click(screen.getByTestId('stock-status-option-instock'));
  toggle();
  expect(variationIds()).toEqual([104, 106]);
  expect(screen.queryByTestId('products-variation-row-105')).toBeNull();
});

test('an attribute option chip opens the row unfiltered and keeps it open', () => {
  inline();
  renderScreen();
  fireEvent.click(screen.getByTestId(`product-attribute-${shirt.id}-Colour-White`));
  expect(variationIds()).toEqual([104, 105, 106]);
  expect(expanded()).toBe('true');
  expect(crumb()).toBeNull();
  fireEvent.click(screen.getByTestId(`product-attribute-${shirt.id}-Size-M`));
  expect(variationIds()).toEqual([104, 105, 106]);
  expect(crumb()).toBeNull();
});

test('the default drill style has no aria-expanded and opens the crumb', () => {
  renderScreen();
  expect(expanded()).toBeNull();
  toggle();
  expect(crumb()).not.toBeNull();
  expect(screen.queryAllByTestId(/^products-variation-row-/)).toHaveLength(0);
  fireEvent.click(screen.getByTestId('products-bar-display'));
  fireEvent.click(screen.getByTestId('products-variations-style-segment-inline'));
  fireEvent.click(screen.getByTestId('products-display-close'));
  expect(crumb()).toBeNull();
  expect(expanded()).toBe('false');
});

test('switching back to drill clears expansion even after returning to inline', () => {
  inline();
  renderScreen();
  toggle();
  expect(variationIds()).toEqual([104, 105, 106]);
  fireEvent.click(screen.getByTestId('products-bar-display'));
  fireEvent.click(screen.getByTestId('products-variations-style-segment-drill'));
  expect(variationIds()).toEqual([]);
  expect(expanded()).toBeNull();
  fireEvent.click(screen.getByTestId('products-variations-style-segment-inline'));
  fireEvent.click(screen.getByTestId('products-display-close'));
  expect(variationIds()).toEqual([]);
  expect(expanded()).toBe('false');
});

test('touch rows expand inline at phone width with no crumb', () => {
  inline();
  setWidth(400);
  renderScreen();
  toggle();
  const rows = within(screen.getByTestId('products-body')).getAllByTestId(/^products-row-\d+$/);
  expect(rows.map(node => node.getAttribute('data-testid'))).toEqual(
    [coldBrew.id, espresso.id, shirt.id, 104, 105, 106].map(id => `products-row-${id}`));
  expect(expanded()).toBe('true');
  expect(crumb()).toBeNull();
});

test('touch variation rows keep their DOM nodes across a re-render', () => {
  inline();
  setWidth(400);
  const { rerender } = renderScreen();
  toggle();
  const before = screen.getByTestId('products-row-104');
  rerender(<ProductsScreen products={catalogue} connector={connector} currency="USD" locale="en_US" onBack={vi.fn()} />);
  expect(screen.getByTestId('products-row-104')).toBe(before);
});

test('sorting by Product reverses the parents while expanded variations follow their parent', () => {
  inline();
  renderScreen();
  toggle();
  const rowIds = () => within(screen.getByTestId('products-body')).getAllByTestId(/^product-row-/)
    .map(node => node.getAttribute('data-testid')!.replace('product-row-', ''));
  expect(rowIds()).toEqual([String(coldBrew.id), String(espresso.id), String(shirt.id), 'variation-104', 'variation-105', 'variation-106']);
  fireEvent.click(screen.getByTestId('product-table-sort-name'));
  expect(rowIds()).toEqual([String(shirt.id), 'variation-104', 'variation-105', 'variation-106', String(espresso.id), String(coldBrew.id)]);
  expect(variationIds()).toEqual([104, 105, 106]);
});

test('variation SKU matches append the found count to the plain variations label', async () => {
  renderScreen();
  const plainLabel = screen.getByTestId(`product-variations-${shirt.id}`).textContent;
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'MER-TEE-S' } });
  await waitFor(() => expect(screen.getByTestId(`product-variations-${shirt.id}`).textContent)
    .toBe(`${plainLabel} - 2 variations found for "MER-TEE-S"`));
});

test('the phone row appends the found count too', async () => {
  setWidth(400);
  renderScreen();
  expect(screen.getByTestId('products-row-' + shirt.id)).not.toBeNull();
  const plainLabel = screen.getByTestId(`product-variations-${shirt.id}`).textContent;
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'MER-TEE-S' } });
  await waitFor(() => expect(screen.getByTestId(`product-variations-${shirt.id}`).textContent)
    .toBe(`${plainLabel} - 2 variations found for "MER-TEE-S"`));
});

test('a parent name match has no variations found suffix', async () => {
  renderScreen();
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'shirt' } });
  await waitFor(() => expect(screen.queryByTestId(`product-row-${espresso.id}`)).toBeNull());
  expect(screen.getByTestId(`product-variations-${shirt.id}`).textContent).not.toContain(' found for ');
});

test('expanded rows follow the variation search and stay expanded when it clears', async () => {
  inline();
  renderScreen();
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'MER-TEE-S' } });
  await waitFor(() => expect(screen.queryByTestId(`product-row-${espresso.id}`)).toBeNull());
  toggle();
  expect(variationIds()).toEqual([104, 105]);
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: '' } });
  await waitFor(() => expect(variationIds()).toEqual([104, 105, 106]));
  expect(expanded()).toBe('true');
});

test('phone touch rows follow the variation search', async () => {
  inline();
  setWidth(400);
  renderScreen();
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'MER-TEE-S' } });
  await waitFor(() => {
    expect(screen.queryByTestId(`products-row-${coldBrew.id}`)).toBeNull();
    expect(screen.queryByTestId(`products-row-${espresso.id}`)).toBeNull();
  });
  toggle();
  const rows = within(screen.getByTestId('products-body')).getAllByTestId(/^products-row-\d+$/);
  expect(rows.map(node => node.getAttribute('data-testid'))).toEqual(
    [shirt.id, 104, 105].map(id => `products-row-${id}`));
});

test('the search picks variations before the stock filter', async () => {
  inline();
  renderScreen();
  fireEvent.click(screen.getByTestId('filter-pill-stock_status'));
  fireEvent.click(screen.getByTestId('stock-status-option-instock'));
  fireEvent.change(screen.getByTestId('search-products'), { target: { value: 'MER-TEE-S-WHT' } });
  await waitFor(() => {
    const rows = within(screen.getByTestId('products-body')).queryAllByTestId(/^product-row-\d+$/);
    expect(rows.map(node => node.getAttribute('data-testid'))).toEqual([`product-row-${shirt.id}`]);
  });
  toggle();
  expect(expanded()).toBe('true');
  expect(variationIds()).toEqual([]);
});
