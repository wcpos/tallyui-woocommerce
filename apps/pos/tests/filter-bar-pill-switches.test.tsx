import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { FILTER_BAR_ORDER_KEY } from '../lib/catalogue/filter-bar-order';
import { FILTER_BAR_PILLS_KEY } from '../lib/catalogue/filter-bar-pills';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { memoryStorage } from './memory-storage';

const quickFilters: QuickFilter[] = [
  { id: 'sale', type: 'quick', label: 'On sale', conditions: [{ field: 'on_sale', value: true }] },
  { id: 'cheap', type: 'quick', label: 'Under 5', conditions: [{ field: 'price', value: { max: 5 } }] },
];

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify(quickFilters));
  // The flat product grid, as in filter-bar-dialog.test.tsx.
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
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
const PILLS = ['stock_status', 'on_sale', 'categories', 'tags'];
const LABELS = ['Stock Status', 'On Sale', 'Categories', 'Tags'];

function renderView() {
  return render(<><CatalogueView {...props} /><PortalHost /></>);
}
function openFilterBar(): void {
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('customize-filter-bar'));
}
function closeFilterBar(): void {
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
}
const toggle = (id: string) => screen.getByTestId(`filter-bar-toggle-${id}`);

test('the dialog lists the built-in filters with icons and switches under v2\'s hint', () => {
  renderView();
  openFilterBar();
  expect(screen.getByTestId('filter-bar-list-hint').textContent).toBe('Switch a filter off to take it off the bar.');
  expect(screen.queryByText(/Drag to reorder/)).toBeNull();
  const rows = screen.getAllByTestId(/^filter-bar-pill-/);
  expect(rows.map(row => row.getAttribute('data-testid'))).toEqual(PILLS.map(id => `filter-bar-pill-${id}`));
  for (const [index, id] of PILLS.entries()) {
    expect(within(rows[index]).getByText(LABELS[index])).not.toBeNull();
    expect(rows[index].querySelector('svg')).not.toBeNull();
    expect(within(rows[index]).getByTestId(`filter-bar-toggle-${id}`).getAttribute('aria-checked')).toBe('true');
  }
  // v2's default bar puts the pills before the quick filters.
  const order = Array.from(screen.getByTestId('filter-bar-modal').querySelectorAll('[data-testid^="filter-bar-pill-"], [data-testid^="filter-bar-item-"]'))
    .map(node => node.getAttribute('data-testid'));
  expect(order).toEqual([...PILLS.map(id => `filter-bar-pill-${id}`), 'filter-bar-item-sale', 'filter-bar-item-cheap']);
});

test('switching On Sale off takes its chip off the bar and clears its filter; on brings the chip back', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  expect(screen.queryByText('Espresso')).toBeNull();
  openFilterBar();
  fireEvent.click(toggle('on_sale'));
  expect(toggle('on_sale').getAttribute('aria-checked')).toBe('false');
  closeFilterBar();
  expect(screen.queryByTestId('filter-pill-on_sale')).toBeNull();
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByTestId('filter-pill-stock_status')).not.toBeNull();
  openFilterBar();
  fireEvent.click(toggle('on_sale'));
  closeFilterBar();
  expect(screen.getByTestId('filter-pill-on_sale').getAttribute('aria-pressed')).toBe('false');
  expect(screen.getByText('Espresso')).not.toBeNull();
});

test('switching Stock Status off resets it to the In Stock baseline', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-stock_status'));
  fireEvent.click(screen.getByTestId('stock-status-option-outofstock'));
  expect(screen.queryByText('Espresso')).toBeNull();
  openFilterBar();
  fireEvent.click(toggle('stock_status'));
  closeFilterBar();
  expect(screen.queryByTestId('filter-pill-stock_status')).toBeNull();
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByText('T-Shirt')).not.toBeNull();
  // Back on, the chip shows the baseline, which the bar does not count as a filter.
  openFilterBar();
  fireEvent.click(toggle('stock_status'));
  closeFilterBar();
  expect(screen.getByTestId('filter-pill-stock_status').textContent).toBe('In Stock');
});

test('a hidden filter stays hidden after a remount, and junk in storage shows every filter', () => {
  const first = renderView();
  openFilterBar();
  fireEvent.click(toggle('tags'));
  closeFilterBar();
  expect(screen.queryByTestId('filter-pill-tags')).toBeNull();
  first.unmount();
  expect(JSON.parse(localStorage.getItem(FILTER_BAR_PILLS_KEY)!)).toEqual(['tags']);
  const second = renderView();
  expect(screen.queryByTestId('filter-pill-tags')).toBeNull();
  expect(screen.getByTestId('filter-pill-categories')).not.toBeNull();
  openFilterBar();
  expect(toggle('tags').getAttribute('aria-checked')).toBe('false');
  expect(toggle('categories').getAttribute('aria-checked')).toBe('true');
  second.unmount();
  for (const junk of ['{"x":1}', '["nope"]', 'not json']) {
    localStorage.setItem(FILTER_BAR_PILLS_KEY, junk);
    const view = renderView();
    for (const id of PILLS) expect(screen.getByTestId(`filter-pill-${id}`)).not.toBeNull();
    view.unmount();
  }
});

test('quick filters keep their move, edit, delete and add controls beside the switches', () => {
  renderView();
  openFilterBar();
  fireEvent.click(toggle('on_sale'));
  fireEvent.click(screen.getByTestId('filter-bar-move-down-sale'));
  expect(screen.getAllByTestId(/^filter-bar-item-/).map(row => row.getAttribute('data-testid')))
    .toEqual(['filter-bar-item-cheap', 'filter-bar-item-sale']);
  expect(JSON.parse(localStorage.getItem(FILTER_BAR_ORDER_KEY)!)).toEqual([...PILLS, 'cheap', 'sale']);
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!).map((qf: QuickFilter) => qf.id)).toEqual(['sale', 'cheap']);
  expect(screen.getByTestId('filter-bar-edit-sale')).not.toBeNull();
  expect(screen.getByTestId('filter-bar-delete-sale')).not.toBeNull();
  expect(screen.getByTestId('filter-bar-add-quick-filter')).not.toBeNull();
  expect(toggle('on_sale').getAttribute('aria-checked')).toBe('false');
});
