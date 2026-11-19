// v2's built-in chip menu (monorepo packages/core/src/screens/main/pos/products/filter-bar/filter-bar.tsx:205-249): a
// long press on Stock Status, On Sale, Category or Tag opens Hide from bar, then Customise filter bar (core en.json:1234,
// :1238). Hide resets the filter to the baseline and takes the chip off the bar; a dimmed chip opens nothing (:147-149).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { FILTER_BAR_PILLS_KEY } from '../lib/catalogue/filter-bar-pills';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import variations from './fixtures/variations.json';
import { memoryStorage } from './memory-storage';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  // The flat product grid, so the Category chip is on the bar (no browse level owns it).
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

function renderView(overrides: Partial<CatalogueViewProps> = {}) {
  return render(<><CatalogueView {...props} {...overrides} /><PortalHost /></>);
}

/** Holds the chip past react-native-web's 500 ms long-press delay, then lets go (as quick-filter-chip-menu.test.tsx). */
function longPress(element: HTMLElement): void {
  vi.useFakeTimers();
  fireEvent.mouseDown(element, { button: 0, buttons: 1 });
  act(() => { vi.advanceTimersByTime(800); });
  fireEvent.mouseUp(element, { button: 0 });
  vi.useRealTimers();
}

const chip = (id: string) => screen.queryByTestId(`filter-pill-${id}`);
const menuRows = () => Array.from(document.querySelectorAll('[data-testid^="filter-bar-menu-"]'))
  .map(row => [row.getAttribute('data-testid'), row.textContent]);
function openFilterBar(): void {
  fireEvent.click(screen.getByTestId('catalogue-settings-button'));
  fireEvent.click(screen.getByTestId('customize-filter-bar'));
}

test('a long press on On Sale opens Hide from bar then Customise filter bar, and Hide clears the filter and the chip', () => {
  renderView();
  fireEvent.click(chip('on_sale')!);
  expect(chip('on_sale')!.getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByText('Espresso')).toBeNull();
  expect(menuRows()).toEqual([]);

  longPress(chip('on_sale')!);
  expect(menuRows()).toEqual([
    ['filter-bar-menu-hide-on_sale', 'Hide from bar'],
    ['filter-bar-menu-customize-on_sale', 'Customise filter bar'],
  ]);
  // The long press opens the menu instead of toggling the chip.
  expect(chip('on_sale')!.getAttribute('aria-pressed')).toBe('true');

  fireEvent.click(screen.getByTestId('filter-bar-menu-hide-on_sale'));
  expect(chip('on_sale')).toBeNull();
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(menuRows()).toEqual([]);
  openFilterBar();
  expect(screen.getByTestId('filter-bar-toggle-on_sale').getAttribute('aria-checked')).toBe('false');
  expect(screen.getByTestId('filter-bar-toggle-stock_status').getAttribute('aria-checked')).toBe('true');
});

test('Hide from bar on Stock Status puts back the In Stock baseline and stays hidden after a remount', () => {
  const first = renderView();
  fireEvent.click(chip('stock_status')!);
  fireEvent.click(screen.getByTestId('stock-status-option-outofstock'));
  expect(screen.queryByText('Espresso')).toBeNull();

  longPress(chip('stock_status')!);
  // The menu, not the Select's list.
  expect(screen.queryByTestId('stock-status-option-instock')).toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-menu-hide-stock_status'));
  expect(chip('stock_status')).toBeNull();
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByText('T-Shirt')).not.toBeNull();
  first.unmount();
  expect(JSON.parse(localStorage.getItem(FILTER_BAR_PILLS_KEY)!)).toEqual(['stock_status']);

  renderView();
  expect(chip('stock_status')).toBeNull();
  expect(chip('on_sale')).not.toBeNull();
  // Back on, the chip shows the baseline it was put back to.
  openFilterBar();
  fireEvent.click(screen.getByTestId('filter-bar-toggle-stock_status'));
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  expect(chip('stock_status')!.textContent).toBe('In Stock');
});

test('Customise filter bar opens the Filter bar dialog', () => {
  renderView();
  expect(screen.queryByTestId('filter-bar-modal')).toBeNull();
  longPress(chip('tags')!);
  fireEvent.click(screen.getByTestId('filter-bar-menu-customize-tags'));
  expect(screen.getByTestId('filter-bar-modal')).not.toBeNull();
  expect(screen.getByTestId('filter-bar-toggle-tags').getAttribute('aria-checked')).toBe('true');
  expect(chip('tags')).not.toBeNull();
});

test('a long press on Category opens the same menu, and a plain press still opens its search list', () => {
  renderView();
  fireEvent.click(chip('categories')!);
  expect(screen.getByTestId('filter-pill-categories-menu')).not.toBeNull();
  expect(menuRows()).toEqual([]);
  fireEvent.click(screen.getByTestId('filter-pill-categories-overlay'));
  expect(screen.queryByTestId('filter-pill-categories-menu')).toBeNull();

  longPress(chip('categories')!);
  expect(menuRows()).toEqual([
    ['filter-bar-menu-hide-categories', 'Hide from bar'],
    ['filter-bar-menu-customize-categories', 'Customise filter bar'],
  ]);
  expect(screen.queryByTestId('filter-pill-categories-menu')).toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-menu-hide-categories'));
  expect(chip('categories')).toBeNull();
  expect(chip('tags')).not.toBeNull();
});

test('while a product is drilled into, a long press on On Sale opens no menu', () => {
  const attributes = [
    { id: 0, name: 'Size', position: 0, visible: true, variation: true, options: ['S', 'M'] },
    { id: 0, name: 'Colour', position: 1, visible: true, variation: true, options: ['Black', 'White'] },
  ];
  const docs = variations.documents.map(doc => ({ ...doc.payload, barcode: doc.payload.global_unique_id }));
  renderView({ products: [products[0], { ...products[2], attributes, variation_docs: docs }], onSelect: vi.fn(), onAddEntry: vi.fn() });
  fireEvent.click(screen.getByTestId('product-tile-102'));
  expect(screen.getByTestId('drill-back')).not.toBeNull();

  longPress(chip('on_sale')!);
  longPress(chip('categories')!);
  expect(menuRows()).toEqual([]);
  // Stock Status is never dimmed (v2 filter-bar.tsx:508), so it keeps its menu.
  longPress(chip('stock_status')!);
  expect(screen.getByTestId('filter-bar-menu-hide-stock_status')).not.toBeNull();
});
