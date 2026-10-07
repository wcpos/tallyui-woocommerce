import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createWooCommerceConnector } from '@tallyui/connector-woocommerce';
import { PortalHost } from '@tallyui/primitives';
import { CatalogueView } from '../components/catalogue-view';
import type { CatalogueViewProps } from '../components/catalogue-view';
import { QUICK_FILTERS_KEY } from '../lib/catalogue/quick-filters';
import type { QuickFilter } from '../lib/catalogue/quick-filters';
import products from './fixtures/products.json';
import stores from './fixtures/stores.json';

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  localStorage.setItem(QUICK_FILTERS_KEY, JSON.stringify(quickFilters));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => Array.from(data.keys())[index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, value); },
  };
}

const props: CatalogueViewProps = {
  connector: createWooCommerceConnector(), currency: stores[0].currency, products,
  storeName: stores[0].name, cashierName: 'Paul', status: 'ready', onSignOut: () => {},
};

const quickFilters: QuickFilter[] = [
  { id: 'sale', type: 'quick', label: 'On sale', conditions: [{ field: 'on_sale', value: true }] },
  { id: 'cheap', type: 'quick', label: 'Under 5', conditions: [{ field: 'price', value: { max: 5 } }] },
];

test('the customise button shows with no quick filters and opens an empty dialog', () => {
  localStorage.removeItem(QUICK_FILTERS_KEY);
  render(<><CatalogueView {...props} /><PortalHost /></>);
  expect(screen.getByTestId('filter-bar-customize')).not.toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  expect(within(screen.getByTestId('filter-bar-modal')).getByText('Filter bar')).not.toBeNull();
  expect(screen.getByTestId('filter-bar-hint')).not.toBeNull();
  expect(screen.queryAllByTestId(/^filter-bar-item-/)).toHaveLength(0);
});

test('the list shows each quick filter with its summary in bar order', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  expect(screen.getAllByTestId(/^filter-bar-item-/).map(row => row.getAttribute('data-testid')))
    .toEqual(['filter-bar-item-sale', 'filter-bar-item-cheap']);
  expect(screen.getByTestId('filter-bar-item-cheap').textContent).toContain('Under 5');
  expect(screen.getByTestId('filter-bar-item-cheap').textContent).toContain('Price up to $5.00');
});

test('adding a quick filter saves it to the bar and storage', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-add-quick-filter'));
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Coffee' } });
  fireEvent.click(screen.getByTestId('quick-filter-add-condition'));
  fireEvent.click(screen.getByTestId('quick-filter-term-categories-25'));
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  expect(screen.getByTestId('filter-bar-hint')).not.toBeNull();
  const rows = screen.getAllByTestId(/^filter-bar-item-/);
  expect(rows).toHaveLength(3);
  expect(rows[2].textContent).toContain('Coffee');
  const saved = JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!);
  expect(saved).toHaveLength(3);
  expect(saved[2].label).toBe('Coffee');
  expect(within(screen.getByTestId('quick-filter-bar')).getByRole('button', { name: 'Coffee' })).not.toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  fireEvent.click(within(screen.getByTestId('quick-filter-bar')).getByRole('button', { name: 'Coffee' }));
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByText('Cold Brew')).not.toBeNull();
  expect(screen.queryByText('T-Shirt')).toBeNull();
});

test('editing a quick filter replaces it in place', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-edit-sale'));
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: '' } });
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Sale items' } });
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  const saved = JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!);
  expect(saved).toHaveLength(2);
  expect(saved.map((qf: QuickFilter) => qf.id)).toEqual(['sale', 'cheap']);
  expect(saved[0]).toEqual({ ...quickFilters[0], label: 'Sale items' });
  expect(screen.getByTestId('quick-filter-sale').textContent).toBe('Sale items');
  expect(screen.getByTestId('filter-bar-hint')).not.toBeNull();
});

test('cancel in the editor changes nothing', () => {
  const saved = localStorage.getItem(QUICK_FILTERS_KEY);
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-edit-sale'));
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Unsaved name' } });
  fireEvent.click(screen.getByTestId('quick-filter-cancel'));
  expect(localStorage.getItem(QUICK_FILTERS_KEY)).toBe(saved);
  expect(screen.getByTestId('filter-bar-hint')).not.toBeNull();
});

test('delete asks first and cancel keeps the quick filter', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-delete-sale'));
  expect(screen.getByText('Delete quick filter?')).not.toBeNull();
  expect(screen.getByTestId('filter-bar-item-sale')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!)).toEqual(quickFilters);
  fireEvent.click(screen.getByTestId('filter-bar-delete-cancel'));
  expect(screen.queryByText('Delete quick filter?')).toBeNull();
  expect(screen.getByTestId('filter-bar-item-sale')).not.toBeNull();
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!)).toEqual(quickFilters);
});

test('confirming a delete removes it from the list, the bar and storage', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-delete-sale'));
  expect(screen.getByText('Delete quick filter?')).not.toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-delete-confirm'));
  expect(screen.queryByTestId('filter-bar-item-sale')).toBeNull();
  expect(screen.queryByTestId('quick-filter-sale')).toBeNull();
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!)).toEqual([quickFilters[1]]);
});

test('deleting the quick filter being edited closes the editor', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-edit-sale'));
  expect(screen.getByTestId('quick-filter-name')).not.toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-delete-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-delete-confirm'));
  expect(screen.queryByTestId('quick-filter-name')).toBeNull();
  expect(screen.getByTestId('filter-bar-hint')).not.toBeNull();
});

test('move buttons reorder the list, the bar and storage', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  expect(screen.getByTestId('filter-bar-move-up-sale').getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByTestId('filter-bar-move-down-cheap').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(screen.getByTestId('filter-bar-move-down-sale'));
  expect(screen.getAllByTestId(/^filter-bar-item-/).map(row => row.getAttribute('data-testid')))
    .toEqual(['filter-bar-item-cheap', 'filter-bar-item-sale']);
  expect(within(screen.getByTestId('quick-filter-bar')).getAllByRole('button').map(button => button.textContent))
    .toEqual(['Under 5', 'On sale']);
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!).map((qf: QuickFilter) => qf.id)).toEqual(['cheap', 'sale']);
  fireEvent.click(screen.getByTestId('filter-bar-move-up-sale'));
  expect(screen.getAllByTestId(/^filter-bar-item-/).map(row => row.getAttribute('data-testid')))
    .toEqual(['filter-bar-item-sale', 'filter-bar-item-cheap']);
  expect(within(screen.getByTestId('quick-filter-bar')).getAllByRole('button').map(button => button.textContent))
    .toEqual(['On sale', 'Under 5']);
  expect(JSON.parse(localStorage.getItem(QUICK_FILTERS_KEY)!).map((qf: QuickFilter) => qf.id)).toEqual(['sale', 'cheap']);
});

test('close shuts the dialog', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  expect(screen.getByTestId('filter-bar-modal')).not.toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  expect(screen.queryByTestId('filter-bar-modal')).toBeNull();
});

test('deleting the applied quick filter clears its filters', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  expect(screen.queryByText('T-Shirt')).toBeNull();
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-delete-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-delete-confirm'));
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByText('Cold Brew')).not.toBeNull();
  expect(screen.getByText('T-Shirt')).not.toBeNull();
});

test('changing the applied quick filter conditions clears its filters', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-edit-sale'));
  fireEvent.click(screen.getByTestId('quick-filter-toggle-on_sale-no'));
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  expect(screen.getByText('Espresso')).not.toBeNull();
  expect(screen.getByText('Cold Brew')).not.toBeNull();
  expect(screen.getByText('T-Shirt')).not.toBeNull();
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('false');
});

test('renaming the applied quick filter keeps it applied', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-edit-sale'));
  fireEvent.change(screen.getByTestId('quick-filter-name'), { target: { value: 'Sale items' } });
  fireEvent.click(screen.getByTestId('quick-filter-save'));
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('quick-filter-sale').textContent).toContain('Sale items');
  expect(screen.queryByText('T-Shirt')).toBeNull();
});

test('reordering keeps the applied quick filter applied', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('quick-filter-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-move-down-sale'));
  fireEvent.click(screen.getByTestId('filter-bar-modal-close'));
  expect(screen.getByTestId('quick-filter-sale').getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByText('T-Shirt')).toBeNull();
});

test('editing another quick filter loads it into the editor', () => {
  render(<><CatalogueView {...props} /><PortalHost /></>);
  fireEvent.click(screen.getByTestId('filter-bar-customize'));
  fireEvent.click(screen.getByTestId('filter-bar-edit-sale'));
  expect((screen.getByTestId('quick-filter-name') as HTMLInputElement).value).toBe('On sale');
  fireEvent.click(screen.getByTestId('filter-bar-edit-cheap'));
  expect((screen.getByTestId('quick-filter-name') as HTMLInputElement).value).toBe('Under 5');
});
