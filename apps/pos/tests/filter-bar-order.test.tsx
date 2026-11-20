import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { FILTER_BAR_ORDER_KEY, normalizeFilterBarOrder } from '../lib/catalogue/filter-bar-order';
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

function renderView() {
  return render(<><CatalogueView {...props} /><PortalHost /></>);
}
function openFilterBar(): void {
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('customize-filter-bar'));
}
function dialogIds() {
  return screen.getAllByTestId(/^filter-bar-(pill|item)-/).map(row => row.getAttribute('data-testid'));
}
function chipIds() {
  return Array.from(screen.getByTestId('catalogue-chip-row').querySelectorAll('[data-testid]'))
    .map(node => node.getAttribute('data-testid'))
    .filter(id => /^(filter-pill-(stock_status|on_sale|categories|tags)|quick-filter-(sale|cheap))$/.test(id!));
}

test('normalizeFilterBarOrder', () => {
  expect(normalizeFilterBarOrder(null, ['sale', 'cheap'])).toEqual([...PILLS, 'sale', 'cheap']);
  expect(normalizeFilterBarOrder(['cheap', 'tags', 'sale', 'cheap', 'gone', 7], ['sale', 'cheap']))
    .toEqual(['cheap', 'tags', 'sale', 'stock_status', 'on_sale', 'categories']);
  expect(normalizeFilterBarOrder(['tags'], ['sale', 'cheap']))
    .toEqual(['tags', 'stock_status', 'on_sale', 'categories', 'sale', 'cheap']);
  expect(normalizeFilterBarOrder('x', [])).toEqual(PILLS);
});

test('the dialog lists one ordered list', () => {
  renderView();
  openFilterBar();
  expect(dialogIds()).toEqual([...PILLS.map(id => `filter-bar-pill-${id}`), 'filter-bar-item-sale', 'filter-bar-item-cheap']);
  expect(screen.getByTestId('filter-bar-move-up-stock_status').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('filter-bar-move-down-cheap').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('filter-bar-move-up-sale').getAttribute('aria-disabled')).not.toBe('true');
});

test('moving a quick filter up past a pill', () => {
  renderView();
  openFilterBar();
  fireEvent.click(screen.getByTestId('filter-bar-move-up-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-move-up-sale'));
  expect(dialogIds()).toEqual(['filter-bar-pill-stock_status', 'filter-bar-pill-on_sale', 'filter-bar-item-sale',
    'filter-bar-pill-categories', 'filter-bar-pill-tags', 'filter-bar-item-cheap']);
  expect(chipIds()).toEqual(['filter-pill-stock_status', 'filter-pill-on_sale', 'quick-filter-sale',
    'filter-pill-categories', 'filter-pill-tags', 'quick-filter-cheap']);
  expect(JSON.parse(localStorage.getItem(FILTER_BAR_ORDER_KEY)!))
    .toEqual(['stock_status', 'on_sale', 'sale', 'categories', 'tags', 'cheap']);
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!).map((qf: QuickFilter) => qf.id)).toEqual(['sale', 'cheap']);
});

test('moving a pill down', () => {
  renderView();
  openFilterBar();
  fireEvent.click(screen.getByTestId('filter-bar-move-down-stock_status'));
  expect(dialogIds().slice(0, 2)).toEqual(['filter-bar-pill-on_sale', 'filter-bar-pill-stock_status']);
  expect(chipIds().slice(0, 2)).toEqual(['filter-pill-on_sale', 'filter-pill-stock_status']);
});

test('the saved order survives a remount', () => {
  localStorage.setItem(FILTER_BAR_ORDER_KEY, JSON.stringify(['cheap', 'tags', 'sale']));
  const first = renderView();
  const expected = ['quick-filter-cheap', 'filter-pill-tags', 'quick-filter-sale',
    'filter-pill-stock_status', 'filter-pill-on_sale', 'filter-pill-categories'];
  expect(chipIds()).toEqual(expected);
  first.unmount();
  renderView();
  expect(chipIds()).toEqual(expected);
});

test('a hidden pill keeps its place in the list', () => {
  localStorage.setItem(FILTER_BAR_ORDER_KEY, JSON.stringify(['cheap', 'tags', 'sale']));
  localStorage.setItem(FILTER_BAR_PILLS_KEY, JSON.stringify(['tags']));
  renderView();
  openFilterBar();
  expect(dialogIds()[1]).toBe('filter-bar-pill-tags');
  expect(within(screen.getByTestId('catalogue-chip-row')).queryByTestId('filter-pill-tags')).toBeNull();
  expect(chipIds()).toEqual(['quick-filter-cheap', 'quick-filter-sale',
    'filter-pill-stock_status', 'filter-pill-on_sale', 'filter-pill-categories']);
});

test('a new quick filter goes last', () => {
  localStorage.setItem(FILTER_BAR_ORDER_KEY, JSON.stringify(['cheap', 'tags', 'sale']));
  renderView();
  openFilterBar();
  fireEvent.click(screen.getByTestId('filter-bar-add-quick-filter'));
  fireEvent.click(screen.getByTestId('quick-filter-start-scratch'));
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Coffee' } });
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  fireEvent.click(screen.getByTestId('quick-filter-term-categories-25'));
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  const saved: QuickFilter[] = JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!);
  expect(saved).toHaveLength(3);
  expect(saved[2].label).toBe('Coffee');
  const rows = screen.getAllByTestId(/^filter-bar-item-/);
  expect(rows[rows.length - 1].getAttribute('data-testid')).toBe(`filter-bar-item-${saved[2].id}`);
  const chips = Array.from(screen.getByTestId('catalogue-chip-row').querySelectorAll('[data-testid]'))
    .map(node => node.getAttribute('data-testid')).filter(id => /^(filter-pill-|quick-filter-)/.test(id!));
  expect(chips[chips.length - 1]).toBe(`quick-filter-${saved[2].id}`);
});
