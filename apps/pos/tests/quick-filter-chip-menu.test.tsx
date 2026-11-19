// v2's quick-filter chip menu (monorepo packages/core/src/screens/main/pos/products/filter-bar/filter-bar.tsx:125-252):
// a long press opens Edit “{label}”, Customise filter bar and Remove from bar; Remove confirms first (:555-564).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
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
  // These tests drive the flat product grid, so they browse All products.
  localStorage.setItem(CATALOGUE_VIEW_KEY, JSON.stringify({ browseBy: 'all' }));
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

function renderView(): void {
  render(<><CatalogueView {...props} /><PortalHost /></>);
}

/** Holds the chip past react-native-web's 500 ms long-press delay, then lets go. */
function longPress(element: HTMLElement): void {
  vi.useFakeTimers();
  fireEvent.mouseDown(element, { button: 0, buttons: 1 });
  act(() => { vi.advanceTimersByTime(800); });
  fireEvent.mouseUp(element, { button: 0 });
  vi.useRealTimers();
}

test('a long press on a quick filter chip opens its menu', () => {
  renderView();
  expect(screen.queryByTestId('filter-bar-menu-edit-sale')).toBeNull();
  longPress(screen.getByTestId('quick-filter-sale'));
  expect(screen.getByTestId('filter-bar-menu-edit-sale').textContent).toBe('Edit “On sale”');
  expect(screen.getByTestId('filter-bar-menu-customize-sale').textContent).toBe('Customise filter bar');
  expect(screen.getByTestId('filter-bar-menu-remove-sale').textContent).toBe('Remove from bar');
  expect(screen.queryByTestId('filter-bar-menu-edit-cheap')).toBeNull();
  // The long press opens the menu instead of applying the filter.
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('false');
});

test('Edit opens the filter bar dialog on that filter', () => {
  renderView();
  longPress(screen.getByTestId('quick-filter-cheap'));
  fireEvent.click(screen.getByTestId('filter-bar-menu-edit-cheap'));
  expect(screen.getByTestId('filter-bar-modal')).not.toBeNull();
  expect(screen.queryByTestId('filter-bar-hint')).toBeNull();
  expect((screen.getByTestId('quick-filter-name') as HTMLInputElement).value).toBe('Under 5');
  expect(screen.queryByTestId('filter-bar-menu-edit-cheap')).toBeNull();
});

test('Customise opens the filter bar dialog', () => {
  renderView();
  longPress(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-menu-customize-sale'));
  expect(screen.getByTestId('filter-bar-modal')).not.toBeNull();
  expect(screen.getByTestId('filter-bar-hint')).not.toBeNull();
  expect(screen.getByTestId('filter-bar-item-sale')).not.toBeNull();
});

test('Remove asks to confirm: Cancel keeps the chip, Delete removes it', () => {
  renderView();
  longPress(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-menu-remove-sale'));
  expect(screen.getByText('Delete quick filter?')).not.toBeNull();
  expect(screen.getByText('This removes the quick filter from the filter bar.')).not.toBeNull();
  expect(screen.queryByTestId('filter-bar-modal')).toBeNull();
  expect(screen.getByTestId('quick-filter-sale')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!)).toEqual(quickFilters);

  fireEvent.click(screen.getByTestId('filter-bar-delete-cancel'));
  expect(screen.queryByText('Delete quick filter?')).toBeNull();
  expect(screen.getByTestId('quick-filter-sale')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!)).toEqual(quickFilters);

  longPress(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-menu-remove-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-delete-confirm'));
  expect(screen.queryByText('Delete quick filter?')).toBeNull();
  expect(screen.queryByTestId('quick-filter-sale')).toBeNull();
  expect(screen.getByTestId('quick-filter-cheap')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!)).toEqual([quickFilters[1]]);
});

test('a short press still applies the filter and opens no menu', () => {
  renderView();
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByText('Cold Brew')).not.toBeNull();
  expect(screen.queryByText('T-Shirt')).toBeNull();
  expect(screen.queryByTestId('filter-bar-menu-edit-sale')).toBeNull();
});
