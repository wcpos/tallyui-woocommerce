import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { CATALOGUE_VIEW_KEY } from '../lib/catalogue/catalogue-view-state';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';
import { memoryStorage } from './memory-storage';

// v2's Save as button (filter-bar.tsx:485-553, capture-quick-filter.tsx, modal.tsx capture mode).
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  // These tests drive the flat product grid, so they browse All products.
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

const renderView = () => render(<><CatalogueView {...props} /><PortalHost /></>);
const trigger = () => screen.queryByTestId('filter-bar-save-as-button');
const stored = () => JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY) ?? '[]');
const visible = (name: string) => screen.queryByText(name) !== null;

function nameAndAdd(label: string): void {
  expect(screen.getByTestId('quick-filter-add').getAttribute('aria-disabled')).toBe('true');
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: label } });
  fireEvent.click(screen.getByTestId('quick-filter-add'));
}

test('the save-as button appears only while a filter is on', () => {
  renderView();
  expect(trigger()).toBeNull();
  fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value: 'Cold' } });
  expect(trigger()).toBeNull();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  expect(trigger()?.getAttribute('aria-label')).toBe('Save as button');
  expect(within(screen.getByTestId('catalogue-chip-row')).getByTestId('filter-bar-save-as-button')).not.toBeNull();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  expect(trigger()).toBeNull();
});

test('saving the capture adds a chip that applies the condition', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  fireEvent.click(trigger()!);
  const modal = screen.getByTestId('filter-bar-modal');
  expect(within(modal).getByText('Save as button')).not.toBeNull();
  expect(within(modal).getByText('Keeps what is on screen now')).not.toBeNull();
  expect(screen.getByTestId('quick-filter-name').getAttribute('placeholder')).toBe('e.g. Sale wines');
  const row = screen.getByTestId('quick-filter-capture-on_sale');
  expect(row.getAttribute('aria-checked')).toBe('true');
  expect(row.textContent).toContain('On Sale');
  expect(screen.queryByTestId('quick-filter-capture-search')).toBeNull();
  expect(screen.queryByTestId('quick-filter-capture-sort')).toBeNull();
  nameAndAdd('  Sale  ');
  expect(screen.queryByTestId('filter-bar-modal')).toBeNull();
  const saved = stored();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ type: 'quick', label: 'Sale', conditions: [{ field: 'on_sale', value: true }] });
  const chip = screen.getByTestId(`quick-filter-${saved[0].id}`);
  expect(chip.textContent).toBe('Sale');
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  expect(visible('Espresso')).toBe(true);
  fireEvent.click(chip);
  expect(chip.getAttribute('aria-pressed')).toBe('true');
  expect(visible('Cold Brew')).toBe(true);
  expect(visible('Espresso')).toBe(false);
});

test('an unticked condition is left out of the saved chip', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  fireEvent.change(screen.getByPlaceholderText('Search products'), { target: { value: '  Cold ' } });
  fireEvent.click(trigger()!);
  const search = () => screen.getByTestId('quick-filter-capture-search');
  expect(search().getAttribute('aria-checked')).toBe('false');
  expect(search().textContent).toContain('Search: Cold');
  fireEvent.click(search());
  expect(search().getAttribute('aria-checked')).toBe('true');
  fireEvent.click(screen.getByTestId('quick-filter-capture-on_sale'));
  expect(screen.getByTestId('quick-filter-capture-on_sale').getAttribute('aria-checked')).toBe('false');
  nameAndAdd('Cold');
  expect(stored()[0].conditions).toEqual([{ field: 'search', value: 'Cold' }]);
});

test('a sort that differs from the settings is offered unticked and kept when ticked', () => {
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify([{ id: 'coffee', type: 'quick', label: 'Coffee cheapest first',
    conditions: [{ field: 'categories', value: [25] }], sort: { field: 'price', dir: 'asc' } }]));
  renderView();
  fireEvent.click(screen.getByTestId('quick-filter-coffee'));
  fireEvent.click(trigger()!);
  expect(screen.getByTestId('quick-filter-capture-categories').textContent).toContain('In category: Coffee');
  const sort = () => screen.getByTestId('quick-filter-capture-sort');
  expect(sort().textContent).toBe("Ordered by Price, low to high (the grid's order right now)");
  expect(sort().getAttribute('aria-checked')).toBe('false');
  fireEvent.click(sort());
  nameAndAdd('Coffee');
  expect(stored()[1]).toMatchObject({ label: 'Coffee', conditions: [{ field: 'categories', value: [25] }], sort: { field: 'price', dir: 'asc' } });
});

test('Close leaves the bar as it was', () => {
  renderView();
  fireEvent.click(screen.getByTestId('filter-pill-on_sale'));
  fireEvent.click(trigger()!);
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Sale' } });
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  expect(screen.queryByTestId('filter-bar-modal')).toBeNull();
  expect(localStorage.getItem(QUICK_FILTERS_KEY)).toBeNull();
});
